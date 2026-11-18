/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centralized Motion & VFX Budget System for Veylentra
 * - Cohesive easing curves, durations, spring tokens, and staggered reveal variants
 * - Viewport & hardware-aware VFX scaling across mobile (<640px), tablet (640-1024px), and desktop
 * - Strict prefers-reduced-motion compliance + offscreen / tab-hidden pause controller
 */

import { useEffect, useState, type RefObject } from 'react';

export const MOTION_EASE = {
  /** Snappy deceleration with refined settle (no sluggish drag) */
  easeOutExpo: [0.16, 1, 0.3, 1] as const,
  /** Balanced UI transition curve */
  easeOutCubic: [0.22, 1, 0.36, 1] as const,
  /** Interactive button & pill press/release feel */
  springTactile: { type: 'spring' as const, stiffness: 420, damping: 28, mass: 0.8 },
  /** Badge & reward reveal overshoot */
  springReveal: { type: 'spring' as const, stiffness: 320, damping: 24, mass: 0.9 },
} as const;

export const MOTION_DURATION = {
  instant: 0.14,
  fast: 0.2,
  normal: 0.28,
  reveal: 0.38,
} as const;

export type ViewportTier = 'mobile' | 'tablet' | 'desktop';

export interface VfxBudget {
  tier: ViewportTier;
  isReducedMotion: boolean;
  ambientSnowCount: number;
  hubSnowCount: number;
  dprCap: number;
  sparkleMultiplier: number;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getVfxBudget(width?: number, reducedOverride?: boolean): VfxBudget {
  const isReducedMotion = reducedOverride ?? prefersReducedMotion();
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const tier: ViewportTier = w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';

  if (isReducedMotion) {
    return {
      tier,
      isReducedMotion: true,
      ambientSnowCount: 0,
      hubSnowCount: 0,
      dprCap: 1,
      sparkleMultiplier: 0,
    };
  }

  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, tier === 'mobile' ? 1.5 : 2) : 1;

  if (tier === 'mobile') {
    return {
      tier,
      isReducedMotion: false,
      ambientSnowCount: 16,
      hubSnowCount: 22,
      dprCap: dpr,
      sparkleMultiplier: 0.55,
    };
  }

  if (tier === 'tablet') {
    return {
      tier,
      isReducedMotion: false,
      ambientSnowCount: 26,
      hubSnowCount: 34,
      dprCap: dpr,
      sparkleMultiplier: 0.8,
    };
  }

  return {
    tier,
    isReducedMotion: false,
    ambientSnowCount: 38,
    hubSnowCount: 52,
    dprCap: dpr,
    sparkleMultiplier: 1,
  };
}

export function useReducedMotionPreference(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  return reduced;
}

export function useVfxBudget(): VfxBudget {
  const reduced = useReducedMotionPreference();
  const [budget, setBudget] = useState<VfxBudget>(() => getVfxBudget(undefined, reduced));

  useEffect(() => {
    const update = () => setBudget(getVfxBudget(window.innerWidth, reduced));
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, [reduced]);

  return budget;
}

/**
 * Tracks both document tab visibility and IntersectionObserver visibility
 * so off-screen banners and snow canvases automatically pause rAF loops.
 */
export function useVfxActive(ref?: RefObject<Element | null>): boolean {
  const [tabVisible, setTabVisible] = useState<boolean>(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  );
  const [inViewport, setInViewport] = useState<boolean>(true);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => setTabVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const el = ref?.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]) {
          setInViewport(entries[0].isIntersecting);
        }
      },
      { threshold: 0.02 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);

  return tabVisible && inViewport;
}

export function getStaggerContainerVariants(reduced: boolean, staggerDelay = 0.04) {
  return {
    hidden: { opacity: reduced ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: reduced
        ? { duration: 0 }
        : {
            staggerChildren: staggerDelay,
            delayChildren: 0.02,
          },
    },
  };
}

export function getItemRevealVariants(reduced: boolean, yOffset = 10) {
  return {
    hidden: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: yOffset },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduced
        ? { duration: 0 }
        : { duration: MOTION_DURATION.normal, ease: MOTION_EASE.easeOutExpo },
    },
  };
}
