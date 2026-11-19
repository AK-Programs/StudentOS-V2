/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cinematic Winter Seasonal Badge Unlock Celebration Modal
 * - Bespoke per-badge / rarity multi-layered crest SVG artwork with pathLength="1" draw-on stroke
 * - 60fps Canvas particle spark burst (Euler physics + gravity + drag, DPI-capped <= 2)
 * - Rarity-calibrated light rays, specular light sweep, & dimensional entrance
 * - Multi-badge queue handling with per-userId sessionStorage deduplication
 * - Accessible: keyboard Escape, focusable controls, static calm fallback under prefers-reduced-motion
 */

import React, { useEffect, useState, useCallback, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { winterAudio } from '../../lib/winterAudio';
import { MOTION_EASE, useReducedMotionPreference } from '../../lib/motionSystem';

export interface BadgeUnlockPayload {
  userId?: string;
  badgeId: string;
  badgeName: string;
  rarity?: 'common' | 'rare' | 'legendary' | 'seasonal' | 'secret';
  description?: string;
  purpose?: string;
}

const RARITY_THEMES: Record<
  string,
  {
    badgeClass: string;
    textGrad: string;
    glowClass: string;
    borderClass: string;
    rayColor: string;
    accentHex: string;
    secondaryHex: string;
    ringHex: string;
    sparkCount: number;
  }
> = {
  legendary: {
    badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/60 shadow-[0_0_18px_rgba(251,191,36,0.38)]',
    textGrad: 'from-amber-200 via-yellow-100 to-amber-400',
    glowClass: 'from-amber-500/35 via-yellow-400/15 to-transparent',
    borderClass: 'border-amber-400/65 shadow-[0_0_45px_rgba(245,158,11,0.34)]',
    rayColor: 'rgba(251, 191, 36, 0.28)',
    accentHex: '#fbbf24',
    secondaryHex: '#fef08a',
    ringHex: '#f59e0b',
    sparkCount: 44,
  },
  secret: {
    badgeClass: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/60 shadow-[0_0_18px_rgba(217,70,239,0.38)]',
    textGrad: 'from-fuchsia-200 via-violet-100 to-cyan-300',
    glowClass: 'from-fuchsia-500/35 via-indigo-400/15 to-transparent',
    borderClass: 'border-fuchsia-400/65 shadow-[0_0_45px_rgba(217,70,239,0.34)]',
    rayColor: 'rgba(217, 70, 239, 0.26)',
    accentHex: '#e879f9',
    secondaryHex: '#67e8f9',
    ringHex: '#a855f7',
    sparkCount: 40,
  },
  rare: {
    badgeClass: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/55 shadow-[0_0_16px_rgba(6,182,212,0.32)]',
    textGrad: 'from-cyan-200 via-sky-100 to-teal-300',
    glowClass: 'from-cyan-500/30 via-sky-400/15 to-transparent',
    borderClass: 'border-cyan-400/60 shadow-[0_0_38px_rgba(6,182,212,0.3)]',
    rayColor: 'rgba(6, 182, 212, 0.24)',
    accentHex: '#22d3ee',
    secondaryHex: '#a5f3fc',
    ringHex: '#0284c7',
    sparkCount: 30,
  },
  seasonal: {
    badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-400/55 shadow-[0_0_16px_rgba(244,63,94,0.3)]',
    textGrad: 'from-rose-200 via-sky-100 to-cyan-300',
    glowClass: 'from-rose-500/30 via-sky-400/15 to-transparent',
    borderClass: 'border-rose-400/55 shadow-[0_0_36px_rgba(244,63,94,0.28)]',
    rayColor: 'rgba(244, 63, 94, 0.22)',
    accentHex: '#fb7185',
    secondaryHex: '#bae6fd',
    ringHex: '#38bdf8',
    sparkCount: 28,
  },
  common: {
    badgeClass: 'bg-sky-500/20 text-sky-200 border-sky-400/45',
    textGrad: 'from-slate-100 via-sky-100 to-slate-200',
    glowClass: 'from-sky-500/20 to-transparent',
    borderClass: 'border-sky-400/45 shadow-[0_0_24px_rgba(56,189,248,0.2)]',
    rayColor: 'rgba(56, 189, 248, 0.16)',
    accentHex: '#38bdf8',
    secondaryHex: '#e0f2fe',
    ringHex: '#0ea5e9',
    sparkCount: 20,
  },
};

const CELEBRATED_STORAGE_KEY_PREFIX = 'veylentra_celebrated_badges_';

function getCelebratedStorageKey(userId?: string | null): string {
  return `${CELEBRATED_STORAGE_KEY_PREFIX}${userId || 'guest'}`;
}

export function getCelebratedBadgeIds(userId?: string | null): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(getCelebratedStorageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markBadgeAsCelebrated(badgeId: string, userId?: string | null) {
  if (typeof window === 'undefined' || !badgeId) return;
  try {
    const existing = getCelebratedBadgeIds(userId);
    existing.add(badgeId);
    sessionStorage.setItem(getCelebratedStorageKey(userId), JSON.stringify(Array.from(existing)));
  } catch {}
}

export function triggerBadgeUnlockCelebration(payload: BadgeUnlockPayload) {
  if (typeof window === 'undefined' || !payload.badgeId) return;
  const celebrated = getCelebratedBadgeIds(payload.userId);
  if (celebrated.has(payload.badgeId)) return;
  markBadgeAsCelebrated(payload.badgeId, payload.userId);
  window.dispatchEvent(
    new CustomEvent('veylentra-badge-celebrate', {
      detail: payload,
    })
  );
}

/**
 * 60fps HTML5 Canvas celebration fountain (diamond shards + soft glow sparks)
 * Semi-implicit Euler integration with dt clamped <= 0.05s, capped DPR <= 2, clean cancelAnimationFrame.
 */
const BadgeSparkCanvas: React.FC<{
  badgeKey: string;
  accentHex: string;
  secondaryHex: string;
  sparkCount: number;
  reduced: boolean;
}> = ({ badgeKey, accentHex, secondaryHex, sparkCount, reduced }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 420;
    const height = 280;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const originX = width * 0.5;
    const originY = height * 0.44;
    const palette = [accentHex, secondaryHex, '#ffffff', accentHex];

    interface SparkParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      rot: number;
      vRot: number;
      alpha: number;
      life: number;
      maxLife: number;
      color: string;
      kind: 'shard' | 'orb';
    }

    const particles: SparkParticle[] = Array.from({ length: sparkCount }).map((_, idx) => {
      const wave = idx >= Math.floor(sparkCount * 0.6) ? 1 : 0;
      const angle = (idx / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const speed = (wave === 0 ? 110 : 75) + Math.random() * 145;
      return {
        x: originX + (Math.random() - 0.5) * 14,
        y: originY + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 42,
        size: 2.8 + Math.random() * 4.2,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 7,
        alpha: 1,
        life: wave === 1 ? -0.18 : 0,
        maxLife: 1.25 + Math.random() * 0.65,
        color: palette[idx % palette.length],
        kind: idx % 3 === 0 ? 'shard' : 'orb',
      };
    });

    let rafId: number | null = null;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      ctx.clearRect(0, 0, width, height);

      let aliveCount = 0;
      for (const p of particles) {
        p.life += dt;
        if (p.life < 0) {
          aliveCount += 1;
          continue;
        }
        if (p.life >= p.maxLife) continue;
        aliveCount += 1;

        const progress = p.life / p.maxLife;
        p.vx *= 1 - 1.35 * dt;
        p.vy = p.vy * (1 - 1.1 * dt) + 150 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vRot * dt;
        p.alpha = progress < 0.2 ? progress / 0.2 : Math.max(0, 1 - (progress - 0.2) / 0.8);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;

        if (p.kind === 'shard') {
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.65, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.65, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.52, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (aliveCount > 0) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        rafId = null;
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [badgeKey, accentHex, secondaryHex, sparkCount, reduced]);

  if (reduced) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '420px', height: '280px' }}
      className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 max-w-full z-20"
      aria-hidden="true"
    />
  );
};

const BadgeEmblemSvg: React.FC<{
  badgeId: string;
  accentHex: string;
  secondaryHex: string;
  ringHex: string;
  reduced: boolean;
}> = ({ badgeId, accentHex, secondaryHex, ringHex, reduced }) => {
  const uid = useId().replace(/:/g, '');
  const shieldGrad = `badgeShield_${uid}`;
  const alloyGrad = `badgeAlloy_${uid}`;

  const renderMotif = () => {
    switch (badgeId) {
      case 'north_star_secret':
        return (
          <g>
            <circle cx="50" cy="50" r="21" stroke={secondaryHex} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />
            <path
              d="M50 18 L55.5 42.5 L80 48 L55.5 53.5 L50 78 L44.5 53.5 L20 48 L44.5 42.5 Z"
              fill={secondaryHex}
              stroke={accentHex}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M50 28 L53 45 L70 48 L53 51 L50 68 L47 51 L30 48 L47 45 Z"
              fill={accentHex}
              opacity="0.85"
            />
            <circle cx="50" cy="48" r="4" fill="#ffffff" />
          </g>
        );
      case 'winter_wheel_ace':
      case 'winter_champion':
        return (
          <g>
            <circle cx="50" cy="50" r="22" fill="rgba(15,23,42,0.6)" stroke={accentHex} strokeWidth="2.4" />
            {[0, 45, 90, 135].map((deg) => (
              <line
                key={deg}
                x1="50"
                y1="28"
                x2="50"
                y2="72"
                stroke={secondaryHex}
                strokeWidth="1.5"
                strokeOpacity="0.65"
                transform={`rotate(${deg}, 50, 50)`}
              />
            ))}
            <path d="M36 42 L43 32 L50 39 L57 32 L64 42 L61 56 H39 Z" fill={accentHex} stroke="#ffffff" strokeWidth="1.3" strokeLinejoin="round" />
            <circle cx="50" cy="48" r="4.2" fill="#ffffff" />
          </g>
        );
      case 'aurora_miracle':
      case 'sleigh_keeper':
        return (
          <g>
            <path d="M24 56 Q38 30 50 42 Q62 54 76 32" stroke={secondaryHex} strokeWidth="4.5" strokeLinecap="round" opacity="0.7" />
            <path d="M27 62 Q41 38 52 48 Q64 58 75 40" stroke={accentHex} strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
            <polygon
              points="50,24 54,36 66,36 56,43 60,55 50,48 40,55 44,43 34,36 46,36"
              fill="#ffffff"
              stroke={accentHex}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </g>
        );
      case 'study_spark':
      case 'winter_scholar':
        return (
          <g>
            <path
              d="M28 36 C36 33 44 35 50 40 C56 35 64 33 72 36 V64 C64 61 56 63 50 67 C44 63 36 61 28 64 Z"
              fill="rgba(248,250,252,0.14)"
              stroke={secondaryHex}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <line x1="50" y1="40" x2="50" y2="67" stroke={accentHex} strokeWidth="1.8" />
            <path d="M50 20 L52.5 27.5 L60 30 L52.5 32.5 L50 40 L47.5 32.5 L40 30 L47.5 27.5 Z" fill={accentHex} />
          </g>
        );
      case 'cocoa_baker':
      case 'cookie_collector':
        return (
          <g>
            <circle cx="50" cy="51" r="19" fill="#b45309" stroke={accentHex} strokeWidth="2.2" />
            <circle cx="50" cy="51" r="14" stroke={secondaryHex} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.65" />
            <circle cx="43" cy="45" r="2.2" fill="#451a03" />
            <circle cx="56" cy="44" r="2" fill="#451a03" />
            <circle cx="52" cy="56" r="2.3" fill="#451a03" />
            <circle cx="42" cy="57" r="1.8" fill="#451a03" />
            <path d="M50 24 L52 29 L57 31 L52 33 L50 38 L48 33 L43 31 L48 29 Z" fill={secondaryHex} />
          </g>
        );
      case 'frosty_focus':
        return (
          <g strokeLinecap="round" strokeLinejoin="round">
            <circle cx="50" cy="50" r="20" stroke={accentHex} strokeWidth="2" fill="rgba(6,182,212,0.1)" />
            <path d="M50 30 V70 M30 50 H70 M36 36 L64 64 M64 36 L36 64" stroke={secondaryHex} strokeWidth="1.8" />
            <polygon points="50,38 59,50 50,62 41,50" fill={accentHex} stroke="#ffffff" strokeWidth="1.3" />
          </g>
        );
      default:
        // snowflake_explorer / frost_starter / snowflake_collector
        return (
          <g strokeLinecap="round" strokeLinejoin="round">
            {[0, 60, 120].map((deg) => (
              <g key={deg} transform={`rotate(${deg}, 50, 50)`}>
                <line x1="50" y1="24" x2="50" y2="76" stroke={secondaryHex} strokeWidth="2.4" />
                <path d="M44 31 L50 36 L56 31" stroke={accentHex} strokeWidth="2" fill="none" />
                <path d="M44 69 L50 64 L56 69" stroke={accentHex} strokeWidth="2" fill="none" />
              </g>
            ))}
            <polygon points="50,43 56,46.5 56,53.5 50,57 44,53.5 44,46.5" fill={accentHex} stroke="#ffffff" strokeWidth="1.4" />
          </g>
        );
    }
  };

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.65)]" aria-hidden="true">
      <defs>
        <linearGradient id={shieldGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="55%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id={alloyGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={secondaryHex} />
          <stop offset="50%" stopColor={accentHex} />
          <stop offset="100%" stopColor={ringHex} />
        </linearGradient>
      </defs>

      {/* Outer Hex Crest Shield Fill */}
      <polygon
        points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5"
        fill={`url(#${shieldGrad})`}
        stroke={reduced ? `url(#${alloyGrad})` : 'rgba(255,255,255,0.12)'}
        strokeWidth="3.2"
      />
      {/* Animated Draw-On Outer Hex Crest Perimeter */}
      {!reduced && (
        <motion.polygon
          key={badgeId}
          points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5"
          fill="none"
          stroke={`url(#${alloyGrad})`}
          strokeWidth="3.4"
          strokeLinejoin="round"
          pathLength={1}
          initial={{ pathLength: 0, opacity: 0.35 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.68, delay: 0.06, ease: MOTION_EASE.easeOutExpo }}
        />
      )}
      <polygon
        points="50,12 83,31 83,69 50,88 17,69 17,31"
        fill="none"
        stroke={secondaryHex}
        strokeWidth="1"
        strokeOpacity="0.4"
      />
      {renderMotif()}
    </svg>
  );
};

export const BadgeUnlockCelebrationModal: React.FC<{
  currentUserId?: string | null;
  onViewCollection?: () => void;
}> = ({ currentUserId, onViewCollection }) => {
  const prefersReduced = useReducedMotionPreference();
  const [queue, setQueue] = useState<BadgeUnlockPayload[]>([]);
  const [activeBadge, setActiveBadge] = useState<BadgeUnlockPayload | null>(null);
  const prevUserRef = useRef<string | null | undefined>(currentUserId);

  useEffect(() => {
    if (prevUserRef.current !== currentUserId) {
      prevUserRef.current = currentUserId;
      setQueue([]);
      setActiveBadge(null);
    }
  }, [currentUserId]);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<BadgeUnlockPayload>;
      if (!customEvent.detail || !customEvent.detail.badgeId) return;
      if (customEvent.detail.userId && currentUserId && customEvent.detail.userId !== currentUserId) {
        return;
      }
      setQueue((prev) => {
        if (prev.some((b) => b.badgeId === customEvent.detail.badgeId)) return prev;
        return [...prev, customEvent.detail];
      });
    };

    window.addEventListener('veylentra-badge-celebrate', handleEvent);
    return () => window.removeEventListener('veylentra-badge-celebrate', handleEvent);
  }, [currentUserId]);

  useEffect(() => {
    if (!activeBadge && queue.length > 0) {
      const next = queue[0];
      setQueue((prev) => prev.slice(1));
      setActiveBadge(next);
      try {
        winterAudio.playBadgeEarned();
      } catch {}
    }
  }, [activeBadge, queue]);

  const handleClose = useCallback(() => {
    setActiveBadge(null);
  }, []);

  useEffect(() => {
    if (!activeBadge) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBadge, handleClose]);

  const handleViewCollectionClick = useCallback(() => {
    handleClose();
    onViewCollection?.();
  }, [handleClose, onViewCollection]);

  const rarity = (activeBadge?.rarity || 'seasonal').toLowerCase();
  const theme = RARITY_THEMES[rarity] || RARITY_THEMES.seasonal;

  return (
    <AnimatePresence>
      {activeBadge && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-unlock-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReduced ? 0.14 : 0.24 }}
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 select-none"
        >
          {/* Dimmed backdrop with blur */}
          <div
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
            onClick={handleClose}
          />

          {/* Layered Light Rays behind card (static aura when reduced motion) */}
          <div
            className={`absolute w-[460px] h-[460px] max-w-full max-h-full pointer-events-none opacity-85 ${
              prefersReduced ? '' : 'veylentra-sunburst-spin'
            }`}
            style={{
              background: `radial-gradient(circle, ${theme.rayColor} 0%, transparent 66%)`,
            }}
            aria-hidden="true"
          />

          {/* Modal Card */}
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 18 }}
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
            transition={prefersReduced ? { duration: 0.14 } : MOTION_EASE.springReveal}
            className={`relative w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border ${theme.borderClass} p-6 sm:p-8 text-center text-white shadow-2xl overflow-hidden`}
          >
            {/* 60fps HTML5 Canvas Spark & Shard Fountain */}
            <BadgeSparkCanvas
              badgeKey={`${activeBadge.userId || 'anon'}:${activeBadge.badgeId}`}
              accentHex={theme.accentHex}
              secondaryHex={theme.secondaryHex}
              sparkCount={theme.sparkCount}
              reduced={prefersReduced}
            />

            {/* Specular Light Sweep across celebration card */}
            {!prefersReduced && (
              <motion.div
                key={`sweep_${activeBadge.badgeId}`}
                initial={{ x: '-140%' }}
                animate={{ x: '220%' }}
                transition={{ duration: 1.05, delay: 0.15, ease: MOTION_EASE.easeOutExpo }}
                className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent z-10"
                aria-hidden="true"
              />
            )}

            {/* Top ambient light wash */}
            <div
              className={`absolute top-0 inset-x-0 h-36 bg-gradient-to-b ${theme.glowClass} pointer-events-none`}
              aria-hidden="true"
            />

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer z-30"
              aria-label="Close unlock celebration"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Eyebrow */}
            <div className="relative z-10 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-sky-300/95 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Badge Unlocked</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </div>

            {/* Dimensional Badge Artwork Centerpiece */}
            <div className="relative mx-auto my-2 w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center z-10">
              {/* Backlight glow */}
              <div
                className="absolute inset-2 rounded-full blur-2xl opacity-65 pointer-events-none"
                style={{ backgroundColor: theme.accentHex }}
              />

              <motion.div
                initial={prefersReduced ? { opacity: 1 } : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={prefersReduced ? { duration: 0 } : MOTION_EASE.springReveal}
                className="relative w-full h-full"
              >
                <BadgeEmblemSvg
                  badgeId={activeBadge.badgeId}
                  accentHex={theme.accentHex}
                  secondaryHex={theme.secondaryHex}
                  ringHex={theme.ringHex}
                  reduced={prefersReduced}
                />
              </motion.div>
            </div>

            {/* Rarity & Queue Counter */}
            <div className="relative z-10 mt-3 flex items-center justify-center gap-2 flex-wrap">
              <span
                className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${theme.badgeClass}`}
              >
                {rarity} Badge
              </span>
              {queue.length > 0 && (
                <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-mono bg-white/10 text-slate-200 border border-white/15">
                  +{queue.length} queued
                </span>
              )}
            </div>

            {/* Badge Name */}
            <h2
              id="badge-unlock-title"
              className={`relative z-10 mt-3 text-2xl sm:text-3xl font-extrabold bg-gradient-to-r ${theme.textGrad} bg-clip-text text-transparent`}
            >
              {activeBadge.badgeName}
            </h2>

            {/* Badge Description */}
            <p className="relative z-10 mt-2 text-xs sm:text-sm text-slate-300/95 leading-relaxed max-w-xs mx-auto">
              {activeBadge.description ||
                activeBadge.purpose ||
                'Awarded for verified achievement during the Veylentra Winter Festival.'}
            </p>

            {/* Action Buttons */}
            <div className="relative z-10 mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
              {onViewCollection && (
                <button
                  type="button"
                  onClick={handleViewCollectionClick}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/20 hover:border-white/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>View Badge Collection</span>
                  <ChevronRight className="w-4 h-4 text-sky-300" />
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="min-h-[44px] px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{queue.length > 0 ? 'Next Badge' : 'Awesome!'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
