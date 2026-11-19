/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Animated Regular Academic & Milestone Badge Unlock Celebration Overlay
 * - Consistent visual system with Winter BadgeUnlockCelebrationModal
 * - Category-calibrated glow, draw-on SVG crest, Canvas burst sparks
 * - FIFO queue + per-user session deduplication (never replays on reload)
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, ChevronRight, X, CheckCircle2, Sparkles } from 'lucide-react';
import {
  REGULAR_BADGE_UNLOCKED_EVENT,
  RegularBadgeUnlockPayload,
} from '../../lib/engagementService';
import { soundService } from '../../lib/soundService';
import { MOTION_EASE, useReducedMotionPreference } from '../../lib/motionSystem';

interface RegularBadgeUnlockModalProps {
  currentUserId?: string;
  onViewCollection?: () => void;
}

const CATEGORY_THEME: Record<
  string,
  { border: string; pill: string; grad: string; accent: string; secondary: string }
> = {
  leaderboard: {
    border: 'border-amber-400/60 shadow-[0_0_40px_rgba(245,158,11,0.3)]',
    pill: 'bg-amber-500/15 border-amber-400/40 text-amber-200',
    grad: 'from-amber-200 via-yellow-100 to-amber-400',
    accent: '#fbbf24',
    secondary: '#fef08a',
  },
  streak: {
    border: 'border-orange-400/60 shadow-[0_0_40px_rgba(249,115,22,0.3)]',
    pill: 'bg-orange-500/15 border-orange-400/40 text-orange-200',
    grad: 'from-orange-200 via-amber-100 to-orange-400',
    accent: '#fb923c',
    secondary: '#fed7aa',
  },
  academic: {
    border: 'border-cyan-400/60 shadow-[0_0_40px_rgba(6,182,212,0.28)]',
    pill: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200',
    grad: 'from-cyan-200 via-sky-100 to-indigo-300',
    accent: '#22d3ee',
    secondary: '#bae6fd',
  },
  milestone: {
    border: 'border-indigo-400/60 shadow-[0_0_40px_rgba(99,102,241,0.28)]',
    pill: 'bg-indigo-500/15 border-indigo-400/40 text-indigo-200',
    grad: 'from-indigo-200 via-white to-purple-300',
    accent: '#818cf8',
    secondary: '#c7d2fe',
  },
};

export const RegularBadgeUnlockModal: React.FC<RegularBadgeUnlockModalProps> = ({
  currentUserId,
  onViewCollection,
}) => {
  const prefersReduced = useReducedMotionPreference();
  const [queue, setQueue] = useState<RegularBadgeUnlockPayload[]>([]);
  const activeItem = queue[0] || null;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setQueue([]);
  }, [currentUserId]);

  useEffect(() => {
    const onBadgeUnlock = (e: Event) => {
      const detail = (e as CustomEvent<RegularBadgeUnlockPayload>).detail;
      if (!detail?.badge) return;
      if (currentUserId && detail.userId && detail.userId !== currentUserId) return;

      setQueue((prev) => {
        if (prev.some((item) => item.badge.id === detail.badge.id && item.userId === detail.userId)) {
          return prev;
        }
        return [...prev, detail];
      });
    };

    window.addEventListener(REGULAR_BADGE_UNLOCKED_EVENT, onBadgeUnlock);
    return () => window.removeEventListener(REGULAR_BADGE_UNLOCKED_EVENT, onBadgeUnlock);
  }, [currentUserId]);

  const handleClose = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  useEffect(() => {
    if (!activeItem) return;
    soundService.playAchievementUnlocked();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeItem, handleClose]);

  useEffect(() => {
    if (!activeItem || prefersReduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const theme = CATEGORY_THEME[activeItem.badge.category] || CATEGORY_THEME.milestone;
    const width = 420;
    const height = 260;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const particles = Array.from({ length: 32 }, (_, idx) => {
      const angle = (Math.PI * 2 * idx) / 32 + (Math.random() - 0.5) * 0.2;
      const speed = 2 + Math.random() * 3.8;
      return {
        x: width / 2,
        y: height * 0.42,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: 1.8 + Math.random() * 2.8,
        alpha: 1,
        color: idx % 2 === 0 ? theme.accent : theme.secondary,
      };
    });

    let rafId = 0;
    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.07;
        p.vx *= 0.985;
        p.alpha -= 0.017;
        if (p.alpha > 0.02) {
          alive = true;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (alive) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activeItem, prefersReduced]);

  const theme = activeItem
    ? CATEGORY_THEME[activeItem.badge.category] || CATEGORY_THEME.milestone
    : CATEGORY_THEME.milestone;

  return (
    <AnimatePresence>
      {activeItem && (
        <div
          className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="regular-badge-unlock-title"
        >
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.28, ease: MOTION_EASE.easeOutExpo }}
            className={`relative w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 border ${theme.border} p-6 text-center`}
          >
            {!prefersReduced && (
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-x-0 top-0 w-full h-[260px]"
                aria-hidden="true"
              />
            )}

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close badge unlock celebration"
              className="absolute top-4 right-4 z-10 p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider ${theme.pill}`}>
                <Sparkles className="w-3.5 h-3.5" />
                {activeItem.badge.category} Achievement
              </div>

              {/* Draw-on SVG crest framing the earned badge */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
                  <motion.polygon
                    points="50,5 89,27 89,73 50,95 11,73 11,27"
                    fill="rgba(15,23,42,0.85)"
                    stroke={theme.accent}
                    strokeWidth="2.5"
                    initial={prefersReduced ? undefined : { pathLength: 0 }}
                    animate={prefersReduced ? undefined : { pathLength: 1 }}
                    transition={{ duration: 0.65, ease: 'easeOut' }}
                  />
                </svg>
                <span className="relative z-10 text-4xl leading-none" role="img" aria-label={activeItem.badge.name}>
                  {activeItem.badge.icon}
                </span>
              </div>

              <div className="space-y-1.5">
                <h3
                  id="regular-badge-unlock-title"
                  className={`text-2xl font-black font-display bg-gradient-to-r ${theme.grad} bg-clip-text text-transparent`}
                >
                  {activeItem.badge.name}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                  {activeItem.badge.description}
                </p>
              </div>

              <div className="w-full flex items-center gap-2 text-left bg-slate-950/75 border border-white/10 rounded-2xl p-3 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Unlocked by completing: <strong className="text-white">{activeItem.badge.unlockRequirement}</strong></span>
              </div>

              <div className="w-full flex items-center gap-2.5 pt-1">
                {onViewCollection && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onViewCollection();
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5 text-cyan-400" />
                    <span>View Badges</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/25"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
