/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real Winter Snow Particle System (Managed Canvas + VFX Budget)
 * - Multi-depth snow particles (background / midground / foreground) with wind sway & parallax
 * - DPR-capped and viewport-budgeted (mobile <640px, tablet 640-1024px, desktop >1024px)
 * - Halts rAF completely when off-screen (IntersectionObserver) or tab-hidden
 * - Honors prefers-reduced-motion cleanly by drawing a single static frost dusting
 */

import React, { useEffect, useRef } from 'react';
import { useVfxActive, useVfxBudget } from '../../lib/motionSystem';

interface Particle {
  x: number;
  y: number;
  vy: number;
  radius: number;
  alpha: number;
  driftPhase: number;
  driftSpeed: number;
  layer: 0 | 1 | 2;
}

export const WinterSnowSystem: React.FC<{
  className?: string;
  density?: 'low' | 'medium' | 'high';
  variant?: 'full' | 'card' | 'subtle';
}> = ({ className = '', density = 'medium', variant = 'card' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vfxActive = useVfxActive(canvasRef);
  const budget = useVfxBudget();
  const activeRef = useRef<boolean>(vfxActive);
  activeRef.current = vfxActive;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cssW = canvas.parentElement?.clientWidth || 320;
    let cssH = canvas.parentElement?.clientHeight || 200;
    const dpr = budget.dprCap || 1;

    const applyCanvasSize = () => {
      if (!canvas.parentElement) return;
      cssW = Math.max(120, canvas.parentElement.clientWidth || 320);
      cssH = Math.max(80, canvas.parentElement.clientHeight || 200);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    applyCanvasSize();

    const baseTarget =
      variant === 'full'
        ? budget.ambientSnowCount
        : density === 'high'
        ? budget.hubSnowCount
        : density === 'low'
        ? Math.max(8, Math.round(budget.ambientSnowCount * 0.45))
        : Math.max(12, Math.round(budget.hubSnowCount * 0.7));

    const particleCount = budget.isReducedMotion
      ? 14
      : variant === 'subtle'
      ? Math.max(8, Math.round(baseTarget * 0.55))
      : baseTarget;

    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const r = Math.random();
      const layer: 0 | 1 | 2 = r < 0.25 ? 2 : r < 0.62 ? 1 : 0;
      particles.push({
        x: Math.random() * cssW,
        y: Math.random() * cssH,
        vy: layer === 2 ? 36 + Math.random() * 22 : layer === 1 ? 22 + Math.random() * 14 : 12 + Math.random() * 9,
        radius: layer === 2 ? 2.0 + Math.random() * 1.1 : layer === 1 ? 1.3 + Math.random() * 0.7 : 0.8 + Math.random() * 0.45,
        alpha: layer === 2 ? 0.72 + Math.random() * 0.2 : layer === 1 ? 0.48 + Math.random() * 0.22 : 0.26 + Math.random() * 0.18,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.6 + Math.random() * 1.1,
        layer,
      });
    }

    if (budget.isReducedMotion) {
      ctx.clearRect(0, 0, cssW, cssH);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 242, 254, ${p.alpha * 0.55})`;
        ctx.fill();
      }
      return;
    }

    let rafId: number | null = null;
    let lastTime = performance.now();

    const step = (time: number) => {
      if (!activeRef.current) {
        rafId = null;
        return;
      }

      const dt = Math.min((time - lastTime) / 1000, 0.033);
      lastTime = time;

      ctx.clearRect(0, 0, cssW, cssH);
      const windGlobal = Math.sin(time * 0.00065) * 10;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.driftPhase += p.driftSpeed * dt;
        const drift = Math.sin(p.driftPhase) * (p.layer === 2 ? 13 : p.layer === 1 ? 8 : 4.5);

        p.x += (windGlobal + drift) * dt;
        p.y += p.vy * dt;

        if (p.x < -8) p.x = cssW + 8;
        else if (p.x > cssW + 8) p.x = -8;

        if (p.y > cssH + 8) {
          p.y = -8;
          p.x = Math.random() * cssW;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle =
          p.layer === 2
            ? `rgba(255, 255, 255, ${p.alpha})`
            : p.layer === 1
            ? `rgba(224, 242, 254, ${p.alpha})`
            : `rgba(186, 230, 253, ${p.alpha})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(step);
    };

    const syncLoop = () => {
      if (activeRef.current && rafId === null) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(step);
      } else if (!activeRef.current && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    syncLoop();

    const onResize = () => applyCanvasSize();
    window.addEventListener('resize', onResize, { passive: true });
    const resumeCheckInterval = window.setInterval(syncLoop, 400);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.clearInterval(resumeCheckInterval);
      window.removeEventListener('resize', onResize);
    };
  }, [density, variant, budget.tier, budget.isReducedMotion, budget.dprCap, budget.ambientSnowCount, budget.hubSnowCount, vfxActive]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 z-[1] w-full h-full rounded-[inherit] ${className}`}
      aria-hidden="true"
    />
  );
};
