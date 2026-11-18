/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centralized Profile Cosmetic Renderer (Winter 4.0 Cinematic Edition):
 * 1. ProfileBannerBackdrop: background identity artwork rendered BEHIND/AROUND the avatar/header.
 * 2. ProfileCosmeticAvatar: avatar image/initials with perimeter-aligned Winter Border (FIXED geometry, zero whole-ring spin).
 * 3. ProfileCosmeticCard: unified Banner + Avatar + Badges composite header.
 *
 * Real Catalog Banner VFX (mapped cleanly to all 6 catalog banners + legacy aliases):
 * 1. midnight_snowfall_banner (`snowfall`): Layered snowy evergreen ridge, drifting valley mist & 3-depth atmospheric snowfall
 * 2. frosted_aurora (`aurora`): Polar mountain horizon, 3 flowing aurora light sheets & northern starlight glints
 * 3. solstice_hearth_banner (`hearth`): Frosted timber frame, warm breathing amber/crimson hearth glow & rising embers
 * 4. candy_ribbon (`peppermint`): Woven diagonal peppermint candy ribbon with traveling satin sheen & sugar-crystal glints
 * 5. starlight_gold (`starlight`): Celestial sleigh trail arc, 4-point Aceternity starlight bursts & golden nebula glow
 * 6. aurora_crown (`crown`): Regal filigree arch, top-edge Aceternity tracing beam & prismatic aurora curtain
 *
 * Perimeter Borders (FIXED base geometry, never rotating the ring, compatible with circle + rounded across xs..xl):
 * 1. frosted_ice_border (`ice`): Stable crystalline rim + traveling Star-Border light comet + cardinal ice nodes
 * 2. snowflake_border (`snowflake`): Stable frosted dashed rim + 4 fixed 6-point hexagonal crystals + twinkling highlights
 * 3. winter_glow_border (`glow`): Dual-phase concentric breathing aura + crisp inner border
 * 4. candy_cane_border (`peppermint`): Alternating interleaved red/white candy segments (fixed offset) + traveling glossy sheen
 * 5. golden_festival_border (`gilded`): Multi-stop gold rim + traveling liquid-gold specular beam + 5-point star glints
 * 6. aurora_prism_border (`prism`): Full-spectrum refraction rim + traveling chromatic wave
 */

import React, { useId, useRef } from 'react';
import {
  getWinterBannerVisual,
  getWinterBorderVisual,
} from '../../lib/winterCosmetics';
import { useReducedMotionPreference, useVfxActive } from '../../lib/motionSystem';

export type CosmeticAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type CosmeticAvatarShape = 'circle' | 'rounded';

const SIZE_MAP: Record<CosmeticAvatarSize, { box: string; text: string; corner: number }> = {
  xs: { box: 'w-8 h-8', text: 'text-[11px]', corner: 11 },
  sm: { box: 'w-9 h-9', text: 'text-xs', corner: 12 },
  md: { box: 'w-12 h-12', text: 'text-sm', corner: 14 },
  lg: { box: 'w-16 h-16', text: 'text-lg', corner: 16 },
  xl: { box: 'w-24 h-24', text: 'text-3xl', corner: 20 },
};

/* ==========================================================================
   BANNER VFX OVERLAYS (Bespoke Artwork-Integrated Scenes per Catalog Banner)
   ========================================================================== */

/** 1. Midnight Snowfall (`midnight_snowfall_banner` / `snowfall`): Evergreen ridges + mist + 3-depth snowfall */
const MidnightSnowfallBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Crisp polar moonlit sky halo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 82% 24%, rgba(186,230,253,0.22) 0%, rgba(56,189,248,0.08) 28%, transparent 58%)',
        }}
      />

      {/* Distant snowy mountain / pine ridge */}
      <svg
        className="absolute bottom-0 inset-x-0 w-full h-[58%] opacity-45 text-slate-950"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        fill="currentColor"
      >
        <path d="M0,100 L0,72 L24,44 L48,70 L76,34 L104,68 L138,26 L172,66 L212,38 L252,72 L292,30 L332,68 L368,40 L400,64 L400,100 Z" />
      </svg>

      {/* Midground pine silhouettes with frosted highlight tip */}
      <svg
        className="absolute bottom-0 inset-x-0 w-full h-[46%] opacity-70 text-slate-950"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        fill="currentColor"
      >
        <path d="M0,100 L0,84 L34,54 L68,86 L108,46 L148,88 L194,42 L238,84 L284,48 L330,86 L370,56 L400,82 L400,100 Z" />
      </svg>

      {/* Drifting cold valley mist */}
      <div className="absolute inset-0 veylentra-forest-mist">
        <div className="w-[125%] h-full bg-gradient-to-r from-transparent via-sky-300/15 to-transparent blur-xl" />
      </div>

      {/* 3-depth parallax atmospheric snowfall */}
      <div className="absolute inset-0 veylentra-pixel-snow-layer-1">
        <span className="absolute top-[6%] left-[10%] w-1.5 h-1.5 rounded-full bg-white/95 shadow-[0_0_6px_#ffffff]" />
        <span className="absolute top-[18%] left-[27%] w-1 h-1 rounded-full bg-sky-100/90" />
        <span className="absolute top-[8%] left-[46%] w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_4px_#ffffff]" />
        <span className="absolute top-[22%] left-[63%] w-1 h-1 rounded-full bg-cyan-100/80" />
        <span className="absolute top-[9%] left-[81%] w-1.5 h-1.5 rounded-full bg-white/95 shadow-[0_0_6px_#ffffff]" />
        <span className="absolute top-[15%] left-[93%] w-1 h-1 rounded-full bg-sky-200/85" />
      </div>
      <div className="absolute inset-0 veylentra-pixel-snow-layer-2 opacity-80">
        <span className="absolute top-[4%] left-[18%] w-1 h-1 rounded-full bg-sky-200/80" />
        <span className="absolute top-[24%] left-[37%] w-1.5 h-1.5 rounded-full bg-cyan-200/70" />
        <span className="absolute top-[14%] left-[55%] w-1 h-1 rounded-full bg-white/75" />
        <span className="absolute top-[27%] left-[74%] w-1.5 h-1.5 rounded-full bg-sky-100/75" />
      </div>
      <div className="absolute inset-0 veylentra-pixel-snow-layer-3 opacity-60">
        <span className="absolute top-[10%] left-[8%] w-0.5 h-0.5 rounded-full bg-white/70" />
        <span className="absolute top-[28%] left-[33%] w-0.5 h-0.5 rounded-full bg-sky-300/70" />
        <span className="absolute top-[12%] left-[71%] w-0.5 h-0.5 rounded-full bg-cyan-200/70" />
        <span className="absolute top-[22%] left-[88%] w-0.5 h-0.5 rounded-full bg-white/70" />
      </div>
    </div>
  );
};

/** 2. Frosted Aurora (`frosted_aurora` / `aurora`): Flowing polar aurora curtains + ridge silhouette */
const AuroraBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Boreal sky zenith */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.18)_0%,transparent_66%)]" />

      {/* Aurora Sheet 1: Vibrant Cyan Wave */}
      <div className="absolute -inset-x-[30%] top-0 h-full w-[82%] veylentra-aurora-sheet-1">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-cyan-400/38 to-transparent blur-md -skew-x-12" />
      </div>
      {/* Aurora Sheet 2: Emerald / Boreal Mint Wave */}
      <div className="absolute -inset-x-[30%] top-[8%] h-[92%] w-[86%] veylentra-aurora-sheet-2">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-emerald-400/32 to-transparent blur-lg skew-x-6" />
      </div>
      {/* Aurora Sheet 3: Polar Sky / Violet Accent */}
      <div className="absolute -inset-x-[30%] top-[18%] h-[82%] w-[78%] veylentra-aurora-sheet-3">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-sky-300/28 via-violet-400/20 to-transparent blur-md -skew-x-6" />
      </div>

      {/* Polar mountain ridge groundline */}
      <svg
        className="absolute bottom-0 inset-x-0 w-full h-[38%] opacity-75 text-slate-950"
        viewBox="0 0 400 80"
        preserveAspectRatio="none"
        fill="currentColor"
      >
        <path d="M0,80 L0,52 L55,24 L110,56 L175,18 L245,54 L310,22 L365,48 L400,36 L400,80 Z" />
      </svg>

      {/* Atmospheric starlight glints */}
      <div className="absolute inset-0">
        <span className="absolute top-[14%] left-[20%] w-1 h-1 rounded-full bg-cyan-200 veylentra-glint-1 shadow-[0_0_6px_#38bdf8]" />
        <span className="absolute top-[28%] left-[56%] w-1.5 h-1.5 rounded-full bg-white veylentra-glint-2 shadow-[0_0_8px_#ffffff]" />
        <span className="absolute top-[18%] left-[83%] w-1 h-1 rounded-full bg-emerald-200 veylentra-glint-1 shadow-[0_0_6px_#34d399]" />
      </div>
    </div>
  );
};

/** 3. Solstice Hearth (`solstice_hearth_banner` / `hearth`): Breathing hearth core + cabin vignette + rising embers */
const HearthBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Frosted window vignette edges contrasting warm center */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 86% 24%, rgba(56,189,248,0.16) 0%, transparent 45%), radial-gradient(ellipse at 32% 64%, rgba(245,158,11,0.22) 0%, transparent 56%)',
        }}
      />

      {/* Warm radial glowing hearth core */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-72 h-36 rounded-full blur-2xl veylentra-hearth-center-glow"
          style={{
            background:
              'radial-gradient(circle, rgba(251,191,36,0.42) 0%, rgba(249,115,22,0.28) 45%, rgba(225,29,72,0.14) 75%, transparent 100%)',
          }}
        />
      </div>

      {/* Subtle frosted cabin silhouette base */}
      <svg
        className="absolute bottom-0 inset-x-0 w-full h-[26%] opacity-55 text-stone-950"
        viewBox="0 0 400 50"
        preserveAspectRatio="none"
        fill="currentColor"
      >
        <path d="M0,50 L0,30 Q100,18 200,26 Q300,34 400,20 L400,50 Z" />
      </svg>

      {/* Rising ember sparks */}
      <div className="absolute inset-0">
        <span className="absolute bottom-[10%] left-[24%] w-1 h-1 rounded-full bg-amber-300 veylentra-ember-1 shadow-[0_0_6px_#f59e0b]" />
        <span className="absolute bottom-[8%] left-[44%] w-1.5 h-1.5 rounded-full bg-yellow-200 veylentra-ember-2 shadow-[0_0_8px_#fbbf24]" />
        <span className="absolute bottom-[12%] left-[58%] w-1 h-1 rounded-full bg-orange-300 veylentra-ember-1 shadow-[0_0_6px_#ea580c]" />
        <span className="absolute bottom-[14%] left-[72%] w-1 h-1 rounded-full bg-amber-200 veylentra-ember-2 shadow-[0_0_6px_#fbbf24]" />
      </div>
    </div>
  );
};

/** 4. Peppermint Ribbon (`candy_ribbon` / `peppermint`): Satin diagonal candy weave + traveling sheen + sugar glints */
const PeppermintBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Moving diagonal ribbon container */}
      <div className="absolute -inset-[60%] w-[220%] h-[220%] veylentra-peppermint-ribbon opacity-32">
        <div
          className="w-full h-full"
          style={{
            background:
              'repeating-linear-gradient(135deg, #e11d48 0px, #e11d48 18px, #ffffff 18px, #ffffff 32px, #fb7185 32px, #fb7185 38px, #ffffff 38px, #ffffff 52px)',
          }}
        />
      </div>

      {/* Traveling satin specular sheen */}
      <div className="absolute inset-0 veylentra-peppermint-sheen-bar">
        <div className="h-full w-28 bg-gradient-to-r from-transparent via-white/45 to-transparent blur-sm -skew-x-12" />
      </div>

      {/* Sugar crystal highlights */}
      <div className="absolute inset-0">
        <span className="absolute top-[26%] left-[22%] w-1.5 h-1.5 rounded-full bg-white veylentra-glint-1 shadow-[0_0_8px_#ffffff]" />
        <span className="absolute top-[60%] left-[74%] w-1.5 h-1.5 rounded-full bg-rose-200 veylentra-glint-2 shadow-[0_0_8px_#fb7185]" />
      </div>
    </div>
  );
};

/** 5. Starlight Sleigh (`starlight_gold` / `starlight`): Celestial sleigh trail arc + 4-point star sparkles */
const StarlightBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.18)_0%,transparent_62%)]" />

      {/* Golden sleigh trajectory ribbon arc */}
      <svg className="absolute inset-0 w-full h-full opacity-55" viewBox="0 0 400 120" preserveAspectRatio="none">
        <path
          d="M-10,92 Q140,22 255,48 T415,24"
          fill="none"
          stroke="#fde047"
          strokeWidth="1.4"
          strokeDasharray="4 4"
        />
      </svg>

      {/* Multi-size twinkling 4-point star sparkles */}
      <svg className="absolute top-[16%] left-[15%] w-4 h-4 text-amber-200 veylentra-sparkle-group-1 drop-shadow-[0_0_6px_#fbbf24]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5Z" />
      </svg>
      <svg className="absolute top-[22%] left-[48%] w-5 h-5 text-yellow-100 veylentra-sparkle-group-2 drop-shadow-[0_0_8px_#fde047]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5Z" />
      </svg>
      <svg className="absolute top-[48%] left-[72%] w-3.5 h-3.5 text-amber-300 veylentra-sparkle-group-3 drop-shadow-[0_0_6px_#f59e0b]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5Z" />
      </svg>
      <span className="absolute top-[64%] left-[28%] w-1.5 h-1.5 rounded-full bg-amber-100 veylentra-glint-2 shadow-[0_0_6px_#fbbf24]" />
      <span className="absolute top-[28%] left-[86%] w-1.5 h-1.5 rounded-full bg-yellow-200 veylentra-glint-1 shadow-[0_0_6px_#fde047]" />
    </div>
  );
};

/** 6. Aurora Crown (`aurora_crown` / `crown`): Top-edge tracing beam + prismatic curtain + crystalline filigree arch */
const CrownBannerVfx: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Subtle flowing northern curtain */}
      <div className="absolute -inset-x-[30%] top-0 h-full w-[80%] veylentra-aurora-sheet-1 opacity-75">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent blur-md -skew-x-12" />
      </div>

      {/* Top edge Aceternity tracing beam */}
      <div className="absolute top-0 left-0 right-0 h-[2.5px] overflow-hidden">
        <div className="h-full w-[45%] bg-gradient-to-r from-transparent via-cyan-200 via-amber-200 to-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.9)] veylentra-crown-beam" />
      </div>

      {/* Royal filigree crown arch + faceted crystalline lines */}
      <div className="absolute inset-0 flex items-center justify-center veylentra-crown-filigree">
        <svg className="w-full h-full opacity-65" viewBox="0 0 400 120" preserveAspectRatio="none">
          <path d="M25,96 Q200,8 375,96" fill="none" stroke="#67e8f9" strokeWidth="1.2" strokeDasharray="3 3" />
          <path d="M90,104 L145,28 L200,66 L255,28 L310,104" fill="none" stroke="#fde047" strokeWidth="0.9" strokeOpacity="0.45" />
        </svg>
      </div>

      <span className="absolute top-[24%] left-[50%] w-2 h-2 rounded-full bg-cyan-100 veylentra-glint-1 shadow-[0_0_10px_#67e8f9]" />
    </div>
  );
};

const BannerVfxRenderer: React.FC<{ vfxType?: string; bannerId?: string }> = ({ vfxType, bannerId }) => {
  switch (bannerId) {
    case 'midnight_snowfall_banner':
      return <MidnightSnowfallBannerVfx />;
    case 'frosted_aurora':
      return <AuroraBannerVfx />;
    case 'solstice_hearth_banner':
      return <HearthBannerVfx />;
    case 'candy_ribbon':
      return <PeppermintBannerVfx />;
    case 'starlight_gold':
      return <StarlightBannerVfx />;
    case 'aurora_crown':
      return <CrownBannerVfx />;
    default:
      break;
  }

  switch (vfxType) {
    case 'snowfall':
      return <MidnightSnowfallBannerVfx />;
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

/* ==========================================================================
   PROFILE BANNER BACKDROP
   ========================================================================== */
export interface ProfileBannerBackdropProps {
  bannerId?: string | null;
  /** Alias supported so all workspace/leaderboard/studio callers render consistently */
  equippedBanner?: string | null;
  bannerUrl?: string | null;
  bannerPresetClass?: string | null;
  className?: string;
  children?: React.ReactNode;
}

export const ProfileBannerBackdrop: React.FC<ProfileBannerBackdropProps> = ({
  bannerId,
  equippedBanner,
  bannerUrl,
  bannerPresetClass,
  className = '',
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const vfxActive = useVfxActive(containerRef);
  const reducedMotion = useReducedMotionPreference();
  const resolvedBannerId = bannerId ?? equippedBanner ?? null;
  const bannerSpec = getWinterBannerVisual(resolvedBannerId);
  const paused = !vfxActive || reducedMotion;

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
          <BannerVfxRenderer vfxType={bannerSpec.vfxType} bannerId={bannerSpec.id} />
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
   BORDER PERIMETER SVG OVERLAY (Fixed Geometry, Path-Traveling Light Only)
   ========================================================================== */
const HexSnowflakeNode: React.FC<{ cx: number; cy: number; color: string; glintClass: string }> = ({
  cx,
  cy,
  color,
  glintClass,
}) => (
  <g transform={`translate(${cx}, ${cy}) scale(0.75)`} className={glintClass}>
    <line x1="0" y1="-4.5" x2="0" y2="4.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="-3.9" y1="-2.25" x2="3.9" y2="2.25" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="3.9" y1="-2.25" x2="-3.9" y2="2.25" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="0" cy="0" r="1.1" fill="#ffffff" />
  </g>
);

const BorderPerimeterSvg: React.FC<{
  motif: 'ice' | 'snowflake' | 'glow' | 'peppermint' | 'gilded' | 'prism';
  shape: 'circle' | 'rounded';
}> = ({ motif, shape }) => {
  const uid = useId().replace(/:/g, '');
  const isCircle = shape === 'circle';
  const iceGradId = `iceComet_${uid}`;
  const gildedGradId = `gildedGrad_${uid}`;
  const prismBaseGradId = `prismBase_${uid}`;
  const prismWaveGradId = `prismWave_${uid}`;

  // Normalized pathLength="100" so strokeDasharray + strokeDashoffset behave identically across circle and rounded
  const pathElement = (
    className: string,
    stroke: string,
    strokeWidth: number,
    strokeDasharray?: string,
    strokeOpacity?: number,
    strokeDashoffset?: number
  ) => {
    if (isCircle) {
      return (
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          pathLength={100}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeOpacity={strokeOpacity}
          className={className}
        />
      );
    }
    return (
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="22"
        fill="none"
        pathLength={100}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeOpacity={strokeOpacity}
        className={className}
      />
    );
  };

  switch (motif) {
    case 'ice':
      // 1. Ice: Fixed crystalline rim + traveling Star-Border light comet + cardinal ice glints
      return (
        <svg viewBox="0 0 100 100" className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none z-[3]" aria-hidden="true">
          <defs>
            <linearGradient id={iceGradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </linearGradient>
          </defs>
          {pathElement('', '#38bdf8', 2.2, undefined, 0.45)}
          {pathElement('veylentra-stroke-travel-ice', `url(#${iceGradId})`, 3.2, '18 82')}
          <circle cx="50" cy="4" r="1.8" fill="#ffffff" className="veylentra-glint-1" />
          <circle cx="96" cy="50" r="1.6" fill="#7dd3fc" className="veylentra-glint-2" />
          <circle cx="50" cy="96" r="1.8" fill="#ffffff" className="veylentra-glint-1" />
          <circle cx="4" cy="50" r="1.6" fill="#7dd3fc" className="veylentra-glint-2" />
        </svg>
      );

    case 'snowflake':
      // 2. Snowflake: Fixed frosted rim + 4 stationary 6-point crystals + path-traveling frost sheen
      return (
        <svg viewBox="0 0 100 100" className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none z-[3]" aria-hidden="true">
          {pathElement('', '#7dd3fc', 2.2, '4 2', 0.58)}
          {pathElement('veylentra-stroke-travel-ice', '#ffffff', 2.6, '14 86', 0.85)}
          <HexSnowflakeNode cx={50} cy={4} color="#ffffff" glintClass="veylentra-glint-1" />
          <HexSnowflakeNode cx={96} cy={50} color="#bae6fd" glintClass="veylentra-glint-2" />
          <HexSnowflakeNode cx={50} cy={96} color="#ffffff" glintClass="veylentra-glint-1" />
          <HexSnowflakeNode cx={4} cy={50} color="#bae6fd" glintClass="veylentra-glint-2" />
        </svg>
      );

    case 'glow':
      // 3. Glow: Fixed inner rim + dual-phase concentric breathing aura in place
      return (
        <svg viewBox="0 0 100 100" className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] pointer-events-none z-[3]" aria-hidden="true">
          {pathElement('', '#22d3ee', 2.2, undefined, 0.55)}
          {pathElement('veylentra-border-aura-1', '#38bdf8', 3, undefined, 0.78)}
          {pathElement('veylentra-border-aura-2', '#34d399', 2.2, undefined, 0.7)}
        </svg>
      );

    case 'peppermint':
      // 4. Peppermint: Properly offset interleaved red & white fixed candy segments + traveling glossy sheen
      return (
        <svg viewBox="0 0 100 100" className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none z-[3]" aria-hidden="true">
          {pathElement('', '#e11d48', 3.1, '5 5', 0.96, 0)}
          {pathElement('', '#ffffff', 3.1, '5 5', 0.96, 5)}
          {pathElement('veylentra-stroke-travel-peppermint', '#ffffff', 3.6, '14 86', 0.88)}
        </svg>
      );

    case 'gilded':
      // 5. Gilded: Fixed ornate gold rim + traveling liquid-gold specular beam + cardinal star glints
      return (
        <svg viewBox="0 0 100 100" className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none z-[3]" aria-hidden="true">
          <defs>
            <linearGradient id={gildedGradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          {pathElement('', `url(#${gildedGradId})`, 2.6, undefined, 0.72)}
          {pathElement('veylentra-stroke-travel-gilded', '#fef08a', 3.4, '16 84', 0.95)}
          <polygon points="50,1 52,6 57,6 53,9 55,14 50,11 45,14 47,9 43,6 48,6" fill="#fbbf24" className="veylentra-glint-1" />
          <polygon points="50,86 52,91 57,91 53,94 55,99 50,96 45,99 47,94 43,91 48,91" fill="#fef08a" className="veylentra-glint-2" />
        </svg>
      );

    case 'prism':
      // 6. Prism: Fixed rainbow refraction rim + traveling chromatic light wave
      return (
        <svg viewBox="0 0 100 100" className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none z-[3]" aria-hidden="true">
          <defs>
            <linearGradient id={prismBaseGradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="33%" stopColor="#a855f7" />
              <stop offset="66%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
            <linearGradient id={prismWaveGradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="50%" stopColor="#67e8f9" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
            </linearGradient>
          </defs>
          {pathElement('', `url(#${prismBaseGradId})`, 2.4, undefined, 0.58)}
          {pathElement('veylentra-stroke-travel-prism', `url(#${prismWaveGradId})`, 3.2, '22 78', 0.9)}
        </svg>
      );

    default:
      return null;
  }
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
   PROFILE COSMETIC AVATAR (Fixed Geometry Perimeter VFX)
   ========================================================================== */
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
  const vfxActive = useVfxActive(containerRef);
  const reducedMotion = useReducedMotionPreference();
  const borderSpec = getWinterBorderVisual(equippedBorder);
  const dim = SIZE_MAP[size];
  const radiusClass = shape === 'rounded' ? 'rounded-2xl' : 'rounded-full';
  const paused = !vfxActive || reducedMotion;

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

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center shrink-0 p-[2.5px] ${radiusClass} ${paused ? 'veylentra-vfx-paused' : ''} ${className}`}
      title={borderSpec.name}
      data-winter-border={borderSpec.id}
    >
      <BorderPerimeterSvg motif={borderSpec.motif} shape={shape} />

      <div className={`relative z-[1] ${radiusClass} flex items-center justify-center`}>
        {avatarNode}
      </div>

      <BorderMotifCorner motif={borderSpec.motif} accentHex={borderSpec.accentHex} size={dim.corner} />
    </div>
  );
};

/* ==========================================================================
   PROFILE COSMETIC CARD (Unified Banner + Avatar Composite Header)
   ========================================================================== */
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
  badgeCount,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-700/60 shadow-lg ${className}`}>
      <ProfileBannerBackdrop
        bannerId={equippedBanner}
        bannerUrl={bannerUrl}
        bannerPresetClass={bannerPresetClass}
        className="h-28 sm:h-32 w-full"
      />

      <div className="relative bg-slate-900/95 px-4 sm:px-6 pb-4 pt-0">
        <div className="flex items-end justify-between -mt-10 sm:-mt-12 gap-3 flex-wrap">
          <div className="flex items-end gap-3 min-w-0">
            <ProfileCosmeticAvatar
              name={name}
              avatarUrl={avatarUrl}
              equippedBorder={equippedBorder}
              permanentFrameClass={permanentFrameClass}
              size="lg"
              shape="rounded"
            />
            <div className="min-w-0 pb-1">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {name || 'Member'}
              </h3>
              <p className="text-xs text-slate-400 capitalize truncate">
                {subtitle || roleLabel || 'Scholar'}
              </p>
            </div>
          </div>
          {typeof badgeCount === 'number' && badgeCount > 0 && (
            <div className="pb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-400/30">
                <span>{badgeCount} {badgeCount === 1 ? 'Badge' : 'Badges'}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
