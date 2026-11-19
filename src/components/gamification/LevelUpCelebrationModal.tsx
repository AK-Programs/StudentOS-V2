/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Animated Scholar Level-Up Celebration Modal
 * - Triggered exclusively on active server/progression level increase via LEVEL_UP_EVENT
 * - Canvas burst particles (Euler physics, capped DPI <= 2) + draw-on SVG crest
 * - Accessible Escape handling, FIFO queue for multi-level jumps, reduced-motion compliant
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, ChevronRight, X, CheckCircle2, Sparkles } from 'lucide-react';
import { LEVEL_UP_EVENT, LevelUpCelebrationPayload } from '../../lib/engagementService';
import { soundService } from '../../lib/soundService';
import { MOTION_EASE, useReducedMotionPreference } from '../../lib/motionSystem';

interface LevelUpCelebrationModalProps {
  currentUserId?: string;
  onViewRoadmap?: () => void;
}

export const LevelUpCelebrationModal: React.FC<LevelUpCelebrationModalProps> = ({
  currentUserId,
  onViewRoadmap,
}) => {
  const prefersReduced = useReducedMotionPreference();
  const [queue, setQueue] = useState<LevelUpCelebrationPayload[]>([]);
  const activeItem = queue[0] || null;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setQueue([]);
  }, [currentUserId]);

  useEffect(() => {
    const onLevelUp = (e: Event) => {
      const detail = (e as CustomEvent<LevelUpCelebrationPayload>).detail;
      if (!detail) return;
      if (currentUserId && detail.userId && detail.userId !== currentUserId) return;

      setQueue((prev) => {
        if (prev.some((q) => q.newLevel === detail.newLevel && q.userId === detail.userId)) {
          return prev;
        }
        return [...prev, detail];
      });
    };

    window.addEventListener(LEVEL_UP_EVENT, onLevelUp);
    return () => window.removeEventListener(LEVEL_UP_EVENT, onLevelUp);
  }, [currentUserId]);

  const handleClose = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  useEffect(() => {
    if (!activeItem) return;
    soundService.playLevelUp();

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

    const width = 420;
    const height = 280;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#fbbf24', '#f59e0b', '#38bdf8', '#a855f7', '#fef08a'];
    const particles = Array.from({ length: 42 }, (_, idx) => {
      const angle = (Math.PI * 2 * idx) / 42 + (Math.random() - 0.5) * 0.25;
      const speed = 2.2 + Math.random() * 4.5;
      return {
        x: width / 2,
        y: height * 0.42,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 2 + Math.random() * 3,
        alpha: 1,
        color: colors[idx % colors.length],
      };
    });

    let rafId = 0;
    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.vx *= 0.985;
        p.alpha -= 0.015;
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

  return (
    <AnimatePresence>
      {activeItem && (
        <div
          className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="level-up-modal-title"
        >
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.3, ease: MOTION_EASE.easeOutExpo }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 border border-amber-400/50 shadow-[0_0_50px_rgba(245,158,11,0.28)] p-6 text-center"
          >
            {!prefersReduced && (
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-x-0 top-0 w-full h-[280px]"
                aria-hidden="true"
              />
            )}

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close level up celebration"
              className="absolute top-4 right-4 z-10 p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative z-10 flex flex-col items-center space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[11px] font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Rank Promotion
              </div>

              <div className="relative flex items-center justify-center">
                <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${activeItem.color} p-0.5 shadow-xl`}>
                  <div className="w-full h-full rounded-[22px] bg-slate-950/85 flex flex-col items-center justify-center">
                    <span className="text-4xl leading-none">{activeItem.icon}</span>
                    <span className="text-[11px] font-black font-mono text-amber-300 mt-1">
                      LVL {activeItem.newLevel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-mono text-slate-400">
                  Level {activeItem.previousLevel} → <span className="text-amber-300 font-bold">Level {activeItem.newLevel}</span>
                </p>
                <h3
                  id="level-up-modal-title"
                  className="text-2xl font-black font-display bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 bg-clip-text text-transparent"
                >
                  {activeItem.levelTitle}
                </h3>
                <p className="text-xs text-slate-300 font-mono tabular-nums">
                  {activeItem.totalXp.toLocaleString()} Total XP
                  {activeItem.xpToNext !== null && ` · ${activeItem.xpToNext.toLocaleString()} XP to Level ${activeItem.newLevel + 1}`}
                </p>
              </div>

              <div className="w-full text-left bg-slate-950/75 border border-white/10 rounded-2xl p-3.5 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Unlocked Progression Benefits
                </span>
                {activeItem.perks.map((perk, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>

              <div className="w-full flex items-center gap-2.5 pt-1">
                {onViewRoadmap && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onViewRoadmap();
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>View Roadmap</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
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
