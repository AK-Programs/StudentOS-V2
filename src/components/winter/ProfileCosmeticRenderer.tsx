/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centralized Profile Cosmetic Renderer (Single Source of Truth):
 * 1. ProfileBannerBackdrop: background identity artwork rendered BEHIND/AROUND the avatar/header.
 * 2. ProfileCosmeticAvatar: avatar image/initials with perimeter-aligned Winter Border or permanent frame.
 * 3. ProfileCosmeticCard: unified Banner + Avatar + Badges composite header.
 *
 * Rebuilt Dynamic VFX:
 * - Banners: Snowfall (Pixel Snow), Aurora (3 light sheets sweep), Peppermint (moving ribbon stripe),
 *            Starlight (Aceternity Sparkles), Crown (top edge tracing beam), Hearth (center breathing radial glow).
 * - Borders: Ice (light travels the ring / Star Border), Snowflake (orbiting flakes),
 *            Glow (soft aura pulse), Peppermint (rotating dashes), Gilded (gold edge shimmer), Prism (slow rainbow ring).
 * - Performance: Compositor-accelerated, pauses when offscreen, respects prefers-reduced-motion.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  WinterBannerVisualSpec,
  getWinterBannerVisual,
  getWinterBorderVisual,
} from '../../lib/winterCosmetics';

export type CosmeticAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type CosmeticAvatarShape = 'circle' | 'rounded';

const SIZE_MAP: Record<CosmeticAvatarSize, { box: string; text: string; corner: number; orbitInset: string }> = {
  xs: { box: 'w-8 h-8', text: 'text-[11px]', corner: 11, orbitInset: '-inset-1' },
  sm: { box: 'w-9 h-9', text: 'text-xs', corner: 12, orbitInset: '-inset-1.5' },
  md: { box: 'w-12 h-12', text: 'text-sm', corner: 14, orbitInset: '-inset-2' },
  lg: { box: 'w-16 h-16', text: 'text-lg', corner: 16, orbitInset: '-inset-2.5' },
  xl: { box: 'w-24 h-24', text: 'text-3xl', corner: 20, orbitInset: '-inset-3' },
};

function useOffscreenVfxPause(ref: React.RefObject<HTMLElement | null>) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setPaused(!entry.isIntersecting);
        }
      },
      { threshold: 0.02 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return paused;
}

/* ==========================================================================
   BANNER VFX OVERLAYS (6 Distinct Dynamic Motion Effects)
   ========================================================================== */

/** 1. Snowfall: Layered flakes fall across the card, like React Bits Pixel Snow */
const SnowfallBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Foreground fast layer (crisp white pixel flakes) */}
      <div className="absolute inset-0 veylentra-pixel-snow-layer-1">
        <span className="absolute top-[5%] left-[8%] w-1.5 h-1.5 rounded-sm bg-white/90 shadow-[0_0_6px_#ffffff]" />
        <span className="absolute top-[12%] left-[24%] w-1 h-1 rounded-full bg-sky-100/90" />
        <span className="absolute top-[8%] left-[42%] w-1.5 h-1.5 rounded-sm bg-white/85 shadow-[0_0_4px_#ffffff]" />
        <span className="absolute top-[18%] left-[58%] w-1 h-1 rounded-full bg-cyan-100/80" />
        <span className="absolute top-[4%] left-[74%] w-1.5 h-1.5 rounded-sm bg-white/90 shadow-[0_0_6px_#ffffff]" />
        <span className="absolute top-[15%] left-[91%] w-1 h-1 rounded-full bg-sky-200/85" />
      </div>
      {/* Midground medium layer (soft cyan flakes) */}
      <div className="absolute inset-0 veylentra-pixel-snow-layer-2 opacity-80">
        <span className="absolute top-[2%] left-[16%] w-1 h-1 rounded-sm bg-sky-200/75" />
        <span className="absolute top-[22%] left-[33%] w-1.5 h-1.5 rounded-sm bg-cyan-200/70" />
        <span className="absolute top-[14%] left-[49%] w-1 h-1 rounded-full bg-white/75" />
        <span className="absolute top-[6%] left-[66%] w-1.5 h-1.5 rounded-sm bg-sky-100/70" />
        <span className="absolute top-[26%] left-[83%] w-1 h-1 rounded-full bg-cyan-100/75" />
      </div>
      {/* Background slow drift layer (tiny floating snow specks) */}
      <div className="absolute inset-0 veylentra-pixel-snow-layer-3 opacity-60">
        <span className="absolute top-[10%] left-[5%] w-0.5 h-0.5 rounded-full bg-white/60" />
        <span className="absolute top-[25%] left-[28%] w-0.5 h-0.5 rounded-full bg-sky-300/60" />
        <span className="absolute top-[5%] left-[52%] w-0.5 h-0.5 rounded-full bg-cyan-200/60" />
        <span className="absolute top-[30%] left-[78%] w-0.5 h-0.5 rounded-full bg-white/60" />
        <span className="absolute top-[12%] left-[96%] w-0.5 h-0.5 rounded-full bg-sky-200/60" />
      </div>
    </div>
  );
};

/** 2. Aurora: 3 light sheets sweep left to right, like Aceternity Aurora / React Bits Aurora Beam */
const AuroraBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Aurora Sheet 1: Vibrant Cyan Ribbon Wave */}
      <div className="absolute -inset-x-[30%] top-0 h-full w-[80%] veylentra-aurora-sheet-1">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent blur-md transform -skew-x-12" />
      </div>
      {/* Aurora Sheet 2: Emerald / Mint Glow Wave */}
      <div className="absolute -inset-x-[30%] top-[10%] h-[90%] w-[85%] veylentra-aurora-sheet-2">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent blur-lg transform skew-x-6" />
      </div>
      {/* Aurora Sheet 3: Ethereal Sky / Indigo Beam */}
      <div className="absolute -inset-x-[30%] top-[20%] h-[80%] w-[75%] veylentra-aurora-sheet-3">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-sky-400/35 to-transparent blur-md transform -skew-x-6" />
      </div>
      {/* Ambient horizon curtain */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
    </div>
  );
};

/** 3. Peppermint: A red and white ribbon stripe moves across */
const PeppermintBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Moving diagonal ribbon container */}
      <div className="absolute -inset-[60%] w-[220%] h-[220%] veylentra-peppermint-ribbon opacity-35">
        <div
          className="w-full h-full"
          style={{
            background:
              'repeating-linear-gradient(135deg, #e11d48 0px, #e11d48 18px, #ffffff 18px, #ffffff 32px, #fb7185 32px, #fb7185 38px, #ffffff 38px, #ffffff 52px)',
          }}
        />
      </div>
      {/* Moving specular sheen highlight bar */}
      <div className="absolute inset-0 veylentra-peppermint-sheen-bar">
        <div className="h-full w-24 bg-gradient-to-r from-transparent via-white/45 to-transparent blur-sm -skew-x-12" />
      </div>
    </div>
  );
};

/** 4. Starlight: Sparkles at different sizes and times, like Aceternity Sparkles */
const StarlightBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Ambient starry backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.18)_0%,transparent_60%)]" />

      {/* Sparkle Group 1: 2.2s pulse (large & small gold stars) */}
      <div className="absolute inset-0">
        <svg
          className="absolute top-[20%] left-[14%] w-4 h-4 text-amber-200 veylentra-sparkle-group-1 drop-shadow-[0_0_8px_#fbbf24]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
        </svg>
        <svg
          className="absolute top-[48%] left-[68%] w-3.5 h-3.5 text-yellow-100 veylentra-sparkle-group-1 drop-shadow-[0_0_6px_#fde047]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
        </svg>
        <span className="absolute top-[75%] left-[32%] w-1.5 h-1.5 rounded-full bg-amber-100 veylentra-sparkle-group-1 shadow-[0_0_8px_#f59e0b]" />
      </div>

      {/* Sparkle Group 2: 3.1s pulse (medium diamond stars) */}
      <div className="absolute inset-0">
        <svg
          className="absolute top-[16%] left-[45%] w-4.5 h-4.5 text-yellow-200 veylentra-sparkle-group-2 drop-shadow-[0_0_10px_#f59e0b]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
        </svg>
        <svg
          className="absolute top-[60%] left-[86%] w-3 h-3 text-amber-100 veylentra-sparkle-group-2 drop-shadow-[0_0_6px_#fbbf24]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
        </svg>
        <span className="absolute top-[35%] left-[82%] w-1.5 h-1.5 rounded-full bg-yellow-200 veylentra-sparkle-group-2 shadow-[0_0_6px_#fbbf24]" />
      </div>

      {/* Sparkle Group 3: 4.2s pulse (delicate starlight pinpricks) */}
      <div className="absolute inset-0">
        <svg
          className="absolute top-[38%] left-[28%] w-3 h-3 text-amber-300 veylentra-sparkle-group-3 drop-shadow-[0_0_6px_#f59e0b]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
        </svg>
        <svg
          className="absolute top-[22%] left-[88%] w-4 h-4 text-yellow-200 veylentra-sparkle-group-3 drop-shadow-[0_0_8px_#fef08a]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
        </svg>
        <span className="absolute top-[65%] left-[55%] w-2 h-2 rounded-full bg-white veylentra-sparkle-group-3 shadow-[0_0_10px_#ffffff]" />
      </div>
    </div>
  );
};

/** 5. Crown: A gold beam runs the top edge, like a tracing beam */
const CrownBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Aceternity-style Top Tracing Beam */}
      <div className="absolute top-0 left-0 right-0 h-[2.5px] overflow-hidden">
        <div className="h-full w-[45%] bg-gradient-to-r from-transparent via-cyan-200 via-amber-200 to-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.9)] veylentra-crown-beam" />
      </div>

      {/* Glacial crown filigree arch pulsing underneath */}
      <div className="absolute inset-0 flex items-center justify-center veylentra-crown-filigree">
        <svg className="w-full h-full opacity-65" viewBox="0 0 400 120" preserveAspectRatio="none">
          <path
            d="M30,95 Q200,8 370,95"
            fill="none"
            stroke="#67e8f9"
            strokeOpacity="0.45"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
          <polygon points="200,10 206,24 194,24" fill="#fde047" fillOpacity="0.85" />
          <polygon points="140,24 145,36 135,36" fill="#38bdf8" fillOpacity="0.65" />
          <polygon points="260,24 265,36 255,36" fill="#38bdf8" fillOpacity="0.65" />
        </svg>
      </div>
    </div>
  );
};

/** 6. Hearth: A warm radial glow breathes from the center */
const HearthBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Pine tree silhouette background */}
      <div className="absolute inset-0 opacity-45">
        <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
          <path d="M0,120 L0,84 L40,56 L76,88 L124,48 L172,92 L224,62 L282,94 L336,54 L400,90 L400,120 Z" fill="#071220" />
        </svg>
      </div>

      {/* Center Breathing Radial Glow Core */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-48 sm:w-64 h-32 rounded-full bg-[radial-gradient(ellipse,rgba(245,158,11,0.65)_0%,rgba(234,88,12,0.35)_45%,transparent_75%)] blur-lg veylentra-hearth-center-glow" />
      </div>

      {/* Rising Floating Embers */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-48 h-20 pointer-events-none">
        <span className="absolute bottom-0 left-[20%] w-1.5 h-1.5 rounded-full bg-amber-300 veylentra-ember-1 shadow-[0_0_8px_#f59e0b]" />
        <span className="absolute bottom-1 left-[45%] w-2 h-2 rounded-full bg-yellow-200 veylentra-ember-2 shadow-[0_0_10px_#f97316]" />
        <span className="absolute bottom-0 left-[68%] w-1.5 h-1.5 rounded-full bg-amber-400 veylentra-ember-1 shadow-[0_0_8px_#ea580c]" />
        <span className="absolute bottom-2 left-[85%] w-1 h-1 rounded-full bg-yellow-100 veylentra-ember-2 shadow-[0_0_6px_#f59e0b]" />
      </div>
    </div>
  );
};

const BannerVfxRenderer: React.FC<{ vfxType: WinterBannerVisualSpec['vfxType'] }> = ({ vfxType }) => {
  switch (vfxType) {
    case 'snowfall':
      return <SnowfallBannerVfx />;
    case 'aurora':
      return <AuroraBannerVfx />;
    case 'peppermint':
      return <PeppermintBannerVfx />;
    case 'starlight':
      return <StarlightBannerVfx />;
    case 'crown':
      return <CrownBannerVfx />;
    case 'hearth':
      return <HearthBannerVfx />;
    default:
      return null;
  }
};

export interface ProfileBannerBackdropProps {
  equippedBanner?: string | null;
  bannerUrl?: string | null;
  bannerPresetClass?: string | null;
  className?: string;
  children?: React.ReactNode;
}

export const ProfileBannerBackdrop: React.FC<ProfileBannerBackdropProps> = ({
  equippedBanner,
  bannerUrl,
  bannerPresetClass,
  className = '',
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const paused = useOffscreenVfxPause(containerRef);
  const bannerSpec = getWinterBannerVisual(equippedBanner);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${paused ? 'veylentra-vfx-paused' : ''} ${className}`}
      style={bannerSpec ? { background: bannerSpec.bgGradient } : undefined}
      data-winter-banner={bannerSpec?.id || undefined}
    >
      {bannerSpec ? (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: bannerSpec.overlayGradient }}
            aria-hidden="true"
          />
          <BannerVfxRenderer vfxType={bannerSpec.vfxType} />
        </>
      ) : bannerUrl ? (
        <img
          src={bannerUrl}
          alt="Profile banner"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className={`absolute inset-0 w-full h-full ${bannerPresetClass || 'bg-gradient-to-r from-slate-800 via-sky-900/60 to-slate-900'}`}
          aria-hidden="true"
        />
      )}
      <div className="relative z-[1] w-full h-full">{children}</div>
    </div>
  );
};

/* ==========================================================================
   BORDER CORNER MOTIF BADGE
   ========================================================================== */
const BorderMotifCorner: React.FC<{
  motif: 'ice' | 'snowflake' | 'glow' | 'peppermint' | 'gilded' | 'prism';
  accentHex: string;
  size: number;
}> = ({ motif, accentHex, size }) => {
  return (
    <span
      className="pointer-events-none absolute -top-1 -right-1 rounded-full bg-slate-950 border border-white/25 flex items-center justify-center shadow-sm z-10"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {motif === 'snowflake' || motif === 'ice' ? (
        <svg viewBox="0 0 16 16" className="w-[70%] h-[70%]" fill="none" stroke={accentHex} strokeWidth="1.6" strokeLinecap="round">
          <line x1="8" y1="2" x2="8" y2="14" />
          <line x1="2.8" y1="5" x2="13.2" y2="11" />
          <line x1="13.2" y1="5" x2="2.8" y2="11" />
        </svg>
      ) : motif === 'gilded' ? (
        <svg viewBox="0 0 16 16" className="w-[72%] h-[72%]" fill={accentHex}>
          <path d="M8 1.5l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 10.9 4.3 13l.8-4.2L2 5.9l4.2-.5L8 1.5z" />
        </svg>
      ) : motif === 'peppermint' ? (
        <span
          className="w-[65%] h-[65%] rounded-full block"
          style={{
            background: 'repeating-linear-gradient(135deg, #f43f5e 0 2px, #ffffff 2px 4px)',
          }}
        />
      ) : motif === 'prism' ? (
        <svg viewBox="0 0 16 16" className="w-[70%] h-[70%]" fill="none" stroke={accentHex} strokeWidth="1.6">
          <polygon points="8,2 13.5,12.5 2.5,12.5" />
        </svg>
      ) : (
        <span className="w-[60%] h-[60%] rounded-full block" style={{ backgroundColor: accentHex }} />
      )}
    </span>
  );
};

/* ==========================================================================
   BORDER MOTION OVERLAY (6 Distinct Visible Motions around Avatar Perimeter)
   ========================================================================== */
const BorderMotionOverlay: React.FC<{
  motif: 'ice' | 'snowflake' | 'glow' | 'peppermint' | 'gilded' | 'prism';
  radiusClass: string;
  orbitInset: string;
}> = ({ motif, radiusClass, orbitInset }) => {
  switch (motif) {
    case 'ice':
      // 1. Ice: A light travels the ring, like Star Border
      return (
        <div
          className={`absolute -inset-[120%] m-auto veylentra-border-ice-light pointer-events-none`}
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, transparent 280deg, #38bdf8 330deg, #ffffff 360deg)',
          }}
          aria-hidden="true"
        />
      );

    case 'snowflake':
      // 2. Snowflake: Small flakes orbit the avatar
      return (
        <div className={`absolute ${orbitInset} pointer-events-none veylentra-snowflake-orbit-ring z-[2]`} aria-hidden="true">
          {/* Top orbiting flake */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 veylentra-snowflake-counter-spin">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-cyan-200 drop-shadow-[0_0_5px_#38bdf8]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="8" y1="1" x2="8" y2="15" />
              <line x1="2" y1="4.5" x2="14" y2="11.5" />
              <line x1="14" y1="4.5" x2="2" y2="11.5" />
            </svg>
          </div>
          {/* Bottom orbiting flake */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 veylentra-snowflake-counter-spin">
            <svg viewBox="0 0 16 16" className="w-3 h-3 text-white drop-shadow-[0_0_4px_#7dd3fc]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="8" y1="1" x2="8" y2="15" />
              <line x1="2" y1="4.5" x2="14" y2="11.5" />
              <line x1="14" y1="4.5" x2="2" y2="11.5" />
            </svg>
          </div>
        </div>
      );

    case 'glow':
      // 3. Glow: A soft aura pulse, not a flat fade
      return (
        <>
          <div className={`absolute -inset-1 ${radiusClass} border-2 border-cyan-400/80 veylentra-border-aura-1 pointer-events-none`} aria-hidden="true" />
          <div className={`absolute -inset-1 ${radiusClass} border-2 border-emerald-300/80 veylentra-border-aura-2 pointer-events-none`} aria-hidden="true" />
        </>
      );

    case 'peppermint':
      // 4. Peppermint: Rotating red and white dashes
      return (
        <div
          className="absolute -inset-[120%] m-auto veylentra-border-peppermint-spin pointer-events-none"
          style={{
            background:
              'repeating-conic-gradient(#e11d48 0deg 18deg, #ffffff 18deg 36deg)',
          }}
          aria-hidden="true"
        />
      );

    case 'gilded':
      // 5. Gilded: A gold shimmer around the edge
      return (
        <div
          className="absolute -inset-[120%] m-auto veylentra-border-gilded-spin pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, #92400e 0deg, #f59e0b 60deg, #fef08a 120deg, #ffffff 140deg, #fbbf24 165deg, #78350f 240deg, #92400e 360deg)',
          }}
          aria-hidden="true"
        />
      );

    case 'prism':
      // 6. Prism: A slow rainbow ring
      return (
        <div
          className="absolute -inset-[120%] m-auto veylentra-border-prism-spin pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #f43f5e, #f59e0b, #10b981, #06b6d4)',
          }}
          aria-hidden="true"
        />
      );

    default:
      return null;
  }
};

export interface ProfileCosmeticAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  equippedBorder?: string | null;
  permanentFrameClass?: string | null;
  size?: CosmeticAvatarSize;
  shape?: CosmeticAvatarShape;
  className?: string;
  fallbackBgClass?: string;
}

export const ProfileCosmeticAvatar: React.FC<ProfileCosmeticAvatarProps> = ({
  name,
  avatarUrl,
  equippedBorder,
  permanentFrameClass,
  size = 'sm',
  shape = 'circle',
  className = '',
  fallbackBgClass = 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const paused = useOffscreenVfxPause(containerRef);
  const borderSpec = getWinterBorderVisual(equippedBorder);
  const dim = SIZE_MAP[size];
  const radiusClass = shape === 'rounded' ? 'rounded-2xl' : 'rounded-full';

  const displayName = (name || 'Member').trim();
  const initials = displayName.slice(0, size === 'xl' ? 1 : 2).toUpperCase();
  const hasPhoto = Boolean(avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:image')));

  const avatarNode = (
    <div
      className={`${dim.box} ${radiusClass} flex items-center justify-center font-bold overflow-hidden ${fallbackBgClass} ${permanentFrameClass || ''}`}
    >
      {hasPhoto ? (
        <img
          src={avatarUrl as string}
          alt={displayName}
          className={`w-full h-full object-cover ${radiusClass}`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className={dim.text}>{initials}</span>
      )}
    </div>
  );

  if (!borderSpec) {
    return (
      <div ref={containerRef} className={`relative inline-flex shrink-0 ${className}`}>
        {avatarNode}
      </div>
    );
  }

  // Active border wrapper: overflow-hidden confines rotating conic gradient; inner bg-slate-950/90 mask preserves avatar.
  const paddingClass = borderSpec.motif === 'glow' ? 'p-[2px]' : 'p-[2.5px]';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center shrink-0 ${paddingClass} ${radiusClass} overflow-hidden ${paused ? 'veylentra-vfx-paused' : ''} ${className}`}
      title={borderSpec.name}
      data-winter-border={borderSpec.id}
    >
      {/* Dynamic Border Motion Overlay */}
      <BorderMotionOverlay motif={borderSpec.motif} radiusClass={radiusClass} orbitInset={dim.orbitInset} />

      {/* Inner Avatar Mask */}
      <div className={`relative z-[1] ${radiusClass} p-[1.5px] bg-slate-950 flex items-center justify-center`}>
        {avatarNode}
      </div>

      {/* Corner Motif Badge */}
      <BorderMotifCorner motif={borderSpec.motif} accentHex={borderSpec.accentHex} size={dim.corner} />
    </div>
  );
};

export const ProfileCosmeticCard: React.FC<{
  name?: string | null;
  avatarUrl?: string | null;
  roleLabel?: string | null;
  equippedBanner?: string | null;
  equippedBorder?: string | null;
  bannerUrl?: string | null;
  bannerPresetClass?: string | null;
  permanentFrameClass?: string | null;
  badgeCount?: number;
  subtitle?: string | null;
  className?: string;
}> = ({
  name,
  avatarUrl,
  roleLabel,
  equippedBanner,
  equippedBorder,
  bannerUrl,
  bannerPresetClass,
  permanentFrameClass,
  badgeCount = 0,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-900 overflow-hidden shadow-lg ${className}`}>
      <ProfileBannerBackdrop
        equippedBanner={equippedBanner}
        bannerUrl={bannerUrl}
        bannerPresetClass={bannerPresetClass}
        className="h-24 sm:h-28 w-full"
      />
      <div className="px-4 pb-4 -mt-9 relative z-10 flex items-end justify-between gap-3">
        <div className="flex items-end gap-3 min-w-0">
          <ProfileCosmeticAvatar
            name={name}
            avatarUrl={avatarUrl}
            equippedBorder={equippedBorder}
            permanentFrameClass={permanentFrameClass}
            size="lg"
          />
          <div className="min-w-0 pb-0.5">
            <p className="text-sm sm:text-base font-black text-white truncate">{name || 'Member'}</p>
            <p className="text-[11px] text-slate-300 truncate">{subtitle || roleLabel || 'StudentOS Member'}</p>
          </div>
        </div>
        {badgeCount > 0 && (
          <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/25 text-sky-200 tabular-nums">
            {badgeCount} Badges
          </span>
        )}
      </div>
    </div>
  );
};
