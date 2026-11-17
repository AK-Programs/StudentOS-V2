/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared Visual Cosmetic Definitions for Winter Profile Banners & Perimeter Borders.
 * Strict visual separation:
 * - Banner = background artwork behind the user's profile avatar & card header
 * - Border = perimeter artwork strictly tracing the avatar contour
 */

export type WinterBannerVfxType = 'aurora' | 'peppermint' | 'starlight' | 'crown' | 'snowfall' | 'hearth';
export type WinterBorderVfxType = 'ice' | 'snowflake' | 'glow' | 'peppermint' | 'gilded' | 'prism';

export interface WinterBannerVisualSpec {
  id: string;
  name: string;
  rarity: 'seasonal' | 'rare' | 'legendary' | 'secret';
  vfxType: WinterBannerVfxType;
  bgGradient: string;
  overlayGradient: string;
  accentHex: string;
  vfxClass: string;
  badgeText: string;
}

export interface WinterBorderVisualSpec {
  id: string;
  name: string;
  rarity: 'seasonal' | 'rare' | 'legendary';
  outerClass: string;
  containerTintClass: string;
  accentHex: string;
  motif: WinterBorderVfxType;
  ringAnimClass: string;
}

export const WINTER_BANNER_VISUALS: Record<string, WinterBannerVisualSpec> = {
  midnight_snowfall_banner: {
    id: 'midnight_snowfall_banner',
    name: 'Midnight Snowfall Banner',
    rarity: 'seasonal',
    vfxType: 'snowfall',
    bgGradient: 'linear-gradient(125deg, #071426 0%, #0c2647 48%, #0e3a5f 100%)',
    overlayGradient:
      'radial-gradient(circle at 22% 28%, rgba(186, 230, 253, 0.28) 0%, transparent 45%), radial-gradient(circle at 78% 22%, rgba(56, 189, 248, 0.22) 0%, transparent 42%)',
    accentHex: '#38bdf8',
    vfxClass: 'veylentra-vfx-snowfall',
    badgeText: 'Seasonal',
  },
  frosted_aurora: {
    id: 'frosted_aurora',
    name: 'Frosted Aurora Banner',
    rarity: 'rare',
    vfxType: 'aurora',
    bgGradient: 'linear-gradient(130deg, #06182c 0%, #0b3453 42%, #0d5066 74%, #082f49 100%)',
    overlayGradient:
      'radial-gradient(ellipse at 30% 20%, rgba(34, 211, 238, 0.42) 0%, transparent 55%), radial-gradient(ellipse at 72% 45%, rgba(52, 211, 153, 0.28) 0%, transparent 52%)',
    accentHex: '#22d3ee',
    vfxClass: 'veylentra-vfx-aurora',
    badgeText: 'Rare',
  },
  solstice_hearth_banner: {
    id: 'solstice_hearth_banner',
    name: 'Solstice Hearth Banner',
    rarity: 'rare',
    vfxType: 'hearth',
    bgGradient: 'linear-gradient(135deg, #1b1318 0%, #3b2018 44%, #102a43 100%)',
    overlayGradient:
      'radial-gradient(circle at 25% 55%, rgba(245, 158, 11, 0.36) 0%, transparent 52%), radial-gradient(circle at 80% 30%, rgba(56, 189, 248, 0.22) 0%, transparent 48%)',
    accentHex: '#f59e0b',
    vfxClass: 'veylentra-vfx-hearth',
    badgeText: 'Rare',
  },
  candy_ribbon: {
    id: 'candy_ribbon',
    name: 'Peppermint Ribbon Banner',
    rarity: 'legendary',
    vfxType: 'peppermint',
    bgGradient: 'linear-gradient(125deg, #2b0b18 0%, #581228 45%, #162238 100%)',
    overlayGradient:
      'repeating-linear-gradient(135deg, rgba(251, 113, 133, 0.22) 0px, rgba(251, 113, 133, 0.22) 14px, rgba(255, 255, 255, 0.14) 14px, rgba(255, 255, 255, 0.14) 28px)',
    accentHex: '#fb7185',
    vfxClass: 'veylentra-vfx-peppermint',
    badgeText: 'Legendary',
  },
  starlight_gold: {
    id: 'starlight_gold',
    name: 'Starlight Sleigh Banner',
    rarity: 'legendary',
    vfxType: 'starlight',
    bgGradient: 'linear-gradient(130deg, #0d1629 0%, #242117 48%, #422b0e 100%)',
    overlayGradient:
      'radial-gradient(circle at 20% 30%, rgba(251, 191, 36, 0.38) 0%, transparent 42%), radial-gradient(circle at 75% 45%, rgba(253, 224, 71, 0.26) 0%, transparent 48%)',
    accentHex: '#fbbf24',
    vfxClass: 'veylentra-vfx-starlight',
    badgeText: 'Legendary',
  },
  aurora_crown: {
    id: 'aurora_crown',
    name: 'Aurora Crown Banner',
    rarity: 'secret',
    vfxType: 'crown',
    bgGradient: 'linear-gradient(135deg, #041d2e 0%, #093b5c 38%, #0f6275 72%, #1d2d50 100%)',
    overlayGradient:
      'radial-gradient(ellipse at 50% 10%, rgba(103, 232, 249, 0.48) 0%, transparent 56%), radial-gradient(ellipse at 20% 70%, rgba(56, 189, 248, 0.28) 0%, transparent 50%)',
    accentHex: '#67e8f9',
    vfxClass: 'veylentra-vfx-crown',
    badgeText: 'Secret',
  },
};

export const WINTER_BORDER_VISUALS: Record<string, WinterBorderVisualSpec> = {
  frosted_ice_border: {
    id: 'frosted_ice_border',
    name: 'Frosted Ice Border',
    rarity: 'seasonal',
    outerClass:
      'p-[2.5px] rounded-full bg-gradient-to-tr from-sky-300 via-cyan-100 to-blue-500 shadow-[0_0_12px_rgba(125,211,252,0.42)]',
    containerTintClass: 'border-sky-300/60 bg-sky-500/10',
    accentHex: '#38bdf8',
    motif: 'ice',
    ringAnimClass: '',
  },
  snowflake_border: {
    id: 'snowflake_border',
    name: 'Snowflake Border',
    rarity: 'seasonal',
    outerClass:
      'p-[2.5px] rounded-full bg-gradient-to-tr from-cyan-400 via-white to-sky-500 shadow-[0_0_14px_rgba(186,230,253,0.48)]',
    containerTintClass: 'border-cyan-300/60 bg-cyan-500/10',
    accentHex: '#7dd3fc',
    motif: 'snowflake',
    ringAnimClass: 'veylentra-border-shimmer',
  },
  winter_glow_border: {
    id: 'winter_glow_border',
    name: 'Winter Glow Border',
    rarity: 'rare',
    outerClass:
      'p-[3px] rounded-full bg-gradient-to-tr from-teal-400 via-sky-400 to-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.55)]',
    containerTintClass: 'border-teal-300/60 bg-teal-500/10',
    accentHex: '#22d3ee',
    motif: 'glow',
    ringAnimClass: 'veylentra-border-shimmer',
  },
  candy_cane_border: {
    id: 'candy_cane_border',
    name: 'Candy Cane Border',
    rarity: 'rare',
    outerClass:
      'p-[3px] rounded-full bg-[repeating-linear-gradient(135deg,#e11d48_0px,#e11d48_5px,#ffffff_5px,#ffffff_10px)] shadow-[0_0_14px_rgba(244,63,94,0.45)]',
    containerTintClass: 'border-rose-400/60 bg-rose-500/10',
    accentHex: '#fb7185',
    motif: 'peppermint',
    ringAnimClass: '',
  },
  aurora_prism_border: {
    id: 'aurora_prism_border',
    name: 'Aurora Prism Border',
    rarity: 'legendary',
    outerClass:
      'p-[3px] rounded-full bg-gradient-to-tr from-cyan-300 via-teal-400 to-sky-500 shadow-[0_0_18px_rgba(6,182,212,0.58)]',
    containerTintClass: 'border-cyan-400/70 bg-cyan-500/10',
    accentHex: '#06b6d4',
    motif: 'prism',
    ringAnimClass: 'veylentra-border-shimmer',
  },
  golden_festival_border: {
    id: 'golden_festival_border',
    name: 'Golden Festival Border',
    rarity: 'legendary',
    outerClass:
      'p-[3px] rounded-full bg-gradient-to-tr from-amber-500 via-yellow-200 to-orange-500 shadow-[0_0_18px_rgba(251,191,36,0.58)]',
    containerTintClass: 'border-amber-400/70 bg-amber-500/10',
    accentHex: '#fbbf24',
    motif: 'gilded',
    ringAnimClass: 'veylentra-border-shimmer',
  },
};

export function getWinterBannerVisual(bannerId?: string | null): WinterBannerVisualSpec | null {
  if (!bannerId) return null;
  return WINTER_BANNER_VISUALS[bannerId] || null;
}

export function getWinterBorderVisual(borderId?: string | null): WinterBorderVisualSpec | null {
  if (!borderId) return null;
  return WINTER_BORDER_VISUALS[borderId] || null;
}
