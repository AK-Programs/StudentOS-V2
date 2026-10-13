/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Lightweight Learning Celebration Burst
 * Inspired by React Bits Confetti / Particles & UIverse Reward Cards
 * Source References:
 * - React Bits: https://reactbits.dev/ (Lightweight celebratory particle burst)
 * - UIverse: https://uiverse.io/ (Pushable reward cards and glowing badges)
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Award, Sparkles, CheckCircle2, Zap } from 'lucide-react';

interface LearningCelebrationProps {
  title: string;
  subtitle?: string;
  xpEarned?: number;
  onClose: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  angle: number;
  speed: number;
  shape: 'circle' | 'square' | 'star';
}

const CELEBRATION_COLORS = [
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6'  // Purple
];

export const LearningCelebration: React.FC<LearningCelebrationProps> = ({
  title,
  subtitle = 'Great progress on your learning path!',
  xpEarned = 50,
  onClose
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (shouldReduceMotion) return;

    // Generate lightweight celebratory particle burst (24 lightweight SVG particles)
    const generated: Particle[] = Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      x: 0,
      y: 0,
      size: Math.floor(Math.random() * 8) + 6,
      color: CELEBRATION_COLORS[i % CELEBRATION_COLORS.length],
      angle: (i / 24) * 360 + Math.random() * 15,
      speed: Math.random() * 120 + 90,
      shape: i % 3 === 0 ? 'star' : i % 2 === 0 ? 'circle' : 'square'
    }));
    setParticles(generated);

    // Auto-dismiss after 3.5 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 3500);

    return () => clearTimeout(timer);
  }, [shouldReduceMotion, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-label="Chapter Completion Celebration"
      >
        {/* Particle Canvas / Floating SVG particles */}
        {!shouldReduceMotion && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
            {particles.map(p => {
              const rad = (p.angle * Math.PI) / 180;
              const targetX = Math.cos(rad) * p.speed;
              const targetY = Math.sin(rad) * p.speed;

              return (
                <motion.div
                  key={p.id}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0.5, rotate: 0 }}
                  animate={{
                    x: targetX,
                    y: targetY + 40,
                    opacity: 0,
                    scale: 1.2,
                    rotate: p.angle * 2
                  }}
                  transition={{ duration: 1.8, ease: 'easeOut' }}
                  className="absolute pointer-events-none"
                  style={{
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    borderRadius: p.shape === 'circle' ? '9999px' : p.shape === 'square' ? '2px' : '0px'
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Modal Card - UIverse glossy 3D card style */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="relative max-w-sm w-full p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/40 shadow-2xl text-center space-y-4 overflow-hidden"
        >
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Trophy Badge Icon with glowing pulse */}
          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 p-0.5 shadow-lg shadow-emerald-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <Award className="w-10 h-10 text-emerald-400 animate-bounce" />
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-1 -right-1"
            >
              <Sparkles className="w-5 h-5 text-amber-300" />
            </motion.div>
          </div>

          <div className="space-y-1 relative">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-400 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Chapter Complete!
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white font-display">
              {title}
            </h3>
            <p className="text-xs text-slate-300">
              {subtitle}
            </p>
          </div>

          {/* XP Banner */}
          <div className="py-2.5 px-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-black text-emerald-300 font-mono">
              +{xpEarned} Scholar XP Added!
            </span>
          </div>

          {/* Action button - UIverse 3D pushable button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-sm transition-all transform active:scale-95 shadow-[0_4px_0_rgb(6,95,70)] hover:brightness-110 cursor-pointer"
          >
            Continue Journey
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
