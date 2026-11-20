/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Animated Streak Recovery Celebration Modal
 * - Listens for STREAK_RECOVERED_EVENT ('studentos-streak-recovered')
 * - Features animated flame crest, canvas particle burst, role-aware summary, and +35 XP reward
 * - Honors reduced-motion preference and Escape key dismiss
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, ShieldCheck, CheckCircle2, Sparkles, X, ArrowRight } from 'lucide-react';
import {
  STREAK_RECOVERED_EVENT,
  StreakRecoveryCelebrationPayload,
} from '../../lib/engagementService';
import { soundService } from '../../lib/soundService';
import { MOTION_EASE, useReducedMotionPreference } from '../../lib/motionSystem';

interface StreakRecoveryCelebrationModalProps {
  currentUserId?: string;
  onContinue?: () => void;
}

export const StreakRecoveryCelebrationModal: React.FC<StreakRecoveryCelebrationModalProps> = ({
  currentUserId,
  onContinue,
}) => {
  const prefersReduced = useReducedMotionPreference();
  const [activeItem, setActiveItem] = useState<StreakRecoveryCelebrationPayload | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const onStreakRecovered = (e: Event) => {
      const detail = (e as CustomEvent<StreakRecoveryCelebrationPayload>).detail;
      if (!detail) return;
      if (currentUserId && detail.userId && detail.userId !== currentUserId) return;
      setActiveItem(detail);
    };

    window.addEventListener(STREAK_RECOVERED_EVENT, onStreakRecovered);
    return () => window.removeEventListener(STREAK_RECOVERED_EVENT, onStreakRecovered);
  }, [currentUserId]);

  const handleClose = useCallback(() => {
    setActiveItem(null);
    onContinue?.();
  }, [onContinue]);

  useEffect(() => {
    if (!activeItem) return;
    try {
      soundService.playLevelUp();
    } catch (_) {}

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeItem, handleClose]);

  // Canvas particle flame fountain
  useEffect(() => {
    if (!activeItem || prefersReduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    ctx.scale(dpr, dpr);

    const colors = ['#06b6d4', '#38bdf8', '#f59e0b', '#fbbf24', '#10b981', '#ffffff'];
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
    }> = [];

    const originX = window.innerWidth / 2;
    const originY = window.innerHeight / 2 - 40;

    for (let i = 0; i < 75; i++) {
      const angle = (Math.PI * 2 * i) / 75 + (Math.random() - 0.5) * 0.3;
      const speed = 3 + Math.random() * 5.5;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 2.5 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.012 + Math.random() * 0.016,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        alive++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // subtle gravity
        p.vx *= 0.985;
        p.alpha = Math.max(0, p.alpha - p.decay);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (alive > 0) {
        animId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeItem, prefersReduced]);

  if (!activeItem) return null;

  const roleName = String(activeItem.role || 'student').toLowerCase();
  const roleHeadline =
    roleName === 'teacher'
      ? 'Attendance Roll & Teaching Flow Verified'
      : roleName === 'admin' || roleName === 'super_admin'
        ? 'Campus Governance & Approvals Certified'
        : roleName === 'coordinator'
          ? 'Department Oversight & Cohort Audit Completed'
          : 'Spaced-Repetition Study Mission Completed';

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="streak-recovery-title"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={handleClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Canvas Burst */}
        {!prefersReduced && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-10 w-full h-full"
          />
        )}

        {/* Modal Window */}
        <motion.div
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
          animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.35, ease: MOTION_EASE.easeOutExpo }}
          className="relative z-20 w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-cyan-500/40 p-6 sm:p-8 text-center shadow-[0_0_60px_rgba(6,182,212,0.25)] space-y-6 overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close streak recovery modal"
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Center Flame & Shield Icon */}
          <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500 to-amber-500 opacity-20 blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-950 to-slate-900 border-2 border-cyan-400/60 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Flame className="w-10 h-10 text-amber-400 fill-amber-400/80 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]" />
              <ShieldCheck className="w-6 h-6 text-cyan-300 absolute -bottom-1 -right-1 drop-shadow-md" />
            </div>
          </div>

          {/* Titles */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>Momentum Preserved</span>
            </div>
            <h3 id="streak-recovery-title" className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Streak Restored!
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              {roleHeadline}
            </p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950/70 border border-white/10">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">New Streak</p>
              <div className="flex items-center justify-center gap-1.5 text-base sm:text-lg font-black text-amber-300 font-mono">
                <span className="text-slate-500 line-through text-xs font-normal">
                  {activeItem.restoredFrom}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                <span>{activeItem.newStreak} Days</span>
              </div>
            </div>
            <div className="space-y-0.5 border-l border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Bonus Award</p>
              <p className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                +{activeItem.xpRewarded} XP
              </p>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Continue to Dashboard</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
