/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Global Animated UI Component Library
 * Sourced and adapted from:
 * - Magic UI (NumberTicker, AnimatedCircularProgressBar, BorderBeam, ShimmerButton)
 * - Aceternity UI (CardSpotlight, MovingBorder, BackgroundBeams, FloatingTabs)
 * - React Bits (SplitTextReveal, TiltedCard, SpotlightGrid)
 * - UIverse (UIversePushableButton, UIverseGlassCard, UIverseToggle, UIverseInput)
 * - Motion / motion/react (Smooth shared layout transitions & physics spring animations)
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion
} from 'motion/react';
import { soundService } from '../../lib/soundService';

// ============================================================================
// 1. MAGIC UI COMPONENTS
// ============================================================================

/**
 * Magic UI — NumberTicker
 * Spring-interpolated tabular numeric ticker for scores, metrics, XP, percentages.
 */
export const NumberTicker: React.FC<{
  value: number;
  direction?: 'up' | 'down';
  delay?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}> = ({
  value,
  direction = 'up',
  delay = 0,
  className = '',
  prefix = '',
  suffix = '',
  decimals = 0
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(direction === 'down' ? value : 0);
  const springVal = useSpring(motionVal, {
    damping: 30,
    stiffness: 120
  });
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) {
      motionVal.set(value);
      return;
    }
    const timer = setTimeout(() => {
      motionVal.set(value);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [motionVal, value, delay, prefersReduced]);

  useEffect(() => {
    return springVal.on('change', (latest) => {
      if (ref.current) {
        const formatted = latest.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
        ref.current.textContent = `${prefix}${formatted}${suffix}`;
      }
    });
  }, [springVal, prefix, suffix, decimals]);

  return (
    <span
      ref={ref}
      className={`inline-block tabular-nums tracking-normal font-mono ${className}`}
    >
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
};

/**
 * Magic UI — AnimatedCircularProgressBar
 * Smooth SVG stroke ring with spring percentage progression.
 */
export const AnimatedCircularProgressBar: React.FC<{
  max?: number;
  value: number;
  min?: number;
  gaugePrimaryColor?: string;
  gaugeSecondaryColor?: string;
  className?: string;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}> = ({
  max = 100,
  value,
  min = 0,
  gaugePrimaryColor = '#6366f1',
  gaugeSecondaryColor = 'rgba(255, 255, 255, 0.08)',
  className = '',
  size = 120,
  strokeWidth = 10,
  children
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 transform"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={gaugeSecondaryColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={gaugePrimaryColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children || (
          <span className="font-mono text-lg font-black text-white">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Magic UI — BorderBeam
 * Animated laser beam that sweeps around the perimeter of card containers.
 */
export const BorderBeam: React.FC<{
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
}> = ({
  className = '',
  size = 200,
  duration = 12,
  borderWidth = 1.5,
  colorFrom = '#6366f1',
  colorTo = '#ec4899'
}) => {
  return (
    <div
      style={
        {
          '--size': `${size}px`,
          '--duration': `${duration}s`,
          '--border-width': `${borderWidth}px`,
          '--color-from': colorFrom,
          '--color-to': colorTo
        } as React.CSSProperties
      }
      className={`pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] ${className}`}
    >
      <div
        className="absolute aspect-square w-full rounded-full bg-gradient-to-r from-[var(--color-from)] to-[var(--color-to)] opacity-75 blur-xs animate-border-beam"
        style={{
          animation: `border-beam var(--duration) infinite linear`
        }}
      />
    </div>
  );
};

/**
 * Magic UI — ShimmerButton
 * Subtle, tactile shimmering action button for primary workflows.
 */
export const ShimmerButton: React.FC<{
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  playClickSound?: boolean;
}> = ({
  children,
  onClick,
  className = '',
  shimmerColor = 'rgba(255, 255, 255, 0.25)',
  shimmerSize = '0.08em',
  borderRadius = '0.75rem',
  shimmerDuration = '2.5s',
  background = 'rgba(99, 102, 241, 0.95)',
  disabled = false,
  type = 'button',
  playClickSound = true
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (playClickSound) {
      soundService.playButtonClick();
    }
    onClick?.(e);
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      style={
        {
          '--shimmer-color': shimmerColor,
          '--shimmer-size': shimmerSize,
          '--border-radius': borderRadius,
          '--shimmer-duration': shimmerDuration,
          '--background': background,
          borderRadius,
          background
        } as React.CSSProperties
      }
      className={`relative inline-flex items-center justify-center px-4 py-2.5 font-bold text-white transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 overflow-hidden cursor-pointer shadow-md ${className}`}
    >
      {/* Moving Shimmer Bar */}
      <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite_linear] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
};

// ============================================================================
// 2. ACETERNITY UI COMPONENTS
// ============================================================================

/**
 * Aceternity UI — CardSpotlight
 * Mouse-tracking radial gradient spotlight for interactive cards.
 */
export const CardSpotlight: React.FC<{
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  radius?: number;
  onClick?: () => void;
}> = ({
  children,
  className = '',
  spotlightColor = 'rgba(99, 102, 241, 0.16)',
  radius = 300,
  onClick
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState<number>(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 transition-colors duration-300 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(${radius}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

/**
 * Aceternity UI — BackgroundBeams
 * Delicate flowing geometric rays for hero headers, auth pages, or focus mode.
 */
export const BackgroundBeams: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden opacity-30 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] ${className}`}
    >
      <svg
        className="absolute left-[50%] top-[50%] h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 stroke-indigo-500/20"
        fill="none"
        viewBox="0 0 1000 1000"
      >
        <defs>
          <radialGradient id="beam-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </radialGradient>
        </defs>
        <line x1="0" y1="0" x2="1000" y2="1000" strokeWidth="1" strokeDasharray="6 8" />
        <line x1="1000" y1="0" x2="0" y2="1000" strokeWidth="1" strokeDasharray="6 8" />
        <circle cx="500" cy="500" r="280" strokeWidth="1" />
        <circle cx="500" cy="500" r="420" strokeWidth="1" strokeDasharray="4 6" />
      </svg>
    </div>
  );
};

/**
 * Aceternity UI — FloatingTabs
 * Pill tab bar with spring-animated layoutId background indicator.
 */
export const FloatingTabs: React.FC<{
  tabs: { id: string; label: string; icon?: React.ReactNode; badge?: string | number }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}> = ({ tabs, activeTab, onTabChange, className = '' }) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg backdrop-blur-md ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              onTabChange(tab.id);
            }}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="floating-tab-active-indicator"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-md shadow-indigo-600/30"
                transition={{ type: 'spring', bounce: 0.22, duration: 0.45 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20 text-white font-extrabold">
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ============================================================================
// 3. REACT BITS COMPONENTS
// ============================================================================

/**
 * React Bits — SplitTextReveal
 * Staggered word or letter entrance animation for page headings.
 */
export const SplitTextReveal: React.FC<{
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}> = ({ text, className = '', delay = 0, stagger = 0.04 }) => {
  const words = text.split(' ');
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={`inline-flex flex-wrap gap-x-1.5 ${className}`}>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block overflow-hidden">
          <motion.span
            className="inline-block"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{
              duration: 0.45,
              delay: delay + wordIndex * stagger,
              ease: [0.2, 0.65, 0.3, 0.9]
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
};

/**
 * React Bits — TiltedCard
 * Interactive 3D mouse tilt card with specular surface sheen.
 */
export const TiltedCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  onClick?: () => void;
}> = ({ children, className = '', maxTilt = 12, onClick }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 200, damping: 25 });
  const mouseYSpring = useSpring(y, { stiffness: 200, damping: 25 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-maxTilt, maxTilt]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width - 0.5;
    const mouseY = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d'
      }}
      className={`relative transition-shadow duration-200 ${className}`}
    >
      <div style={{ transform: 'translateZ(20px)' }}>{children}</div>
    </motion.div>
  );
};

// ============================================================================
// 4. UIVERSE COMPONENTS
// ============================================================================

/**
 * UIverse — UIversePushableButton
 * Multi-layer 3D tactile pushable arcade button with spring depth feedback.
 */
export const UIversePushableButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  disabled?: boolean;
}> = ({ children, onClick, className = '', color = 'indigo', disabled = false }) => {
  const colorMap = {
    indigo: {
      shadow: 'bg-indigo-950',
      edge: 'bg-indigo-800',
      front: 'bg-indigo-600 hover:bg-indigo-500'
    },
    emerald: {
      shadow: 'bg-emerald-950',
      edge: 'bg-emerald-800',
      front: 'bg-emerald-600 hover:bg-emerald-500'
    },
    amber: {
      shadow: 'bg-amber-950',
      edge: 'bg-amber-800',
      front: 'bg-amber-600 hover:bg-amber-500'
    },
    rose: {
      shadow: 'bg-rose-950',
      edge: 'bg-rose-800',
      front: 'bg-rose-600 hover:bg-rose-500'
    },
    slate: {
      shadow: 'bg-slate-950',
      edge: 'bg-slate-800',
      front: 'bg-slate-700 hover:bg-slate-600'
    }
  };

  const scheme = colorMap[color];

  const handleClick = () => {
    if (disabled) return;
    soundService.playButtonClick();
    onClick?.();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`group relative inline-block border-none bg-transparent p-0 outline-none cursor-pointer select-none transition-transform disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      <span className={`absolute top-0 left-0 w-full h-full rounded-xl ${scheme.shadow} translate-y-1.5 transition-transform`} />
      <span className={`absolute top-0 left-0 w-full h-full rounded-xl ${scheme.edge} translate-y-1 transition-transform`} />
      <span className={`relative block px-4 py-2.5 rounded-xl font-bold text-xs text-white ${scheme.front} -translate-y-1 transition-transform group-hover:-translate-y-1.5 group-active:translate-y-0 shadow-sm`}>
        {children}
      </span>
    </button>
  );
};

/**
 * UIverse — UIverseGlassCard
 * Sleek frosted glass card container with border specular highlight.
 */
export const UIverseGlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl bg-slate-900/60 p-5 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 hover:border-white/20 hover:shadow-indigo-500/5 ${className}`}
    >
      {/* Top Glass Specular Shine */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      {children}
    </div>
  );
};

/**
 * UIverse — UIverseToggle
 * Mechanical tactile switch for toggling audio, themes, notifications.
 */
export const UIverseToggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, className = '', disabled = false }) => {
  const handleToggle = () => {
    if (disabled) return;
    soundService.playButtonClick();
    onChange(!checked);
  };

  return (
    <label
      onClick={handleToggle}
      className={`inline-flex items-center gap-3 cursor-pointer select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <div
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
          checked ? 'bg-indigo-600' : 'bg-slate-800 border border-white/10'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      {label && <span className="text-xs font-semibold text-slate-300">{label}</span>}
    </label>
  );
};
