/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared Visual Cosmetic Definitions for Winter Profile Frames & Winter Borders.
 * Designed to stack cleanly: outer Winter Border encloses the inner Frame + Avatar
 * without breaking permanent AVATAR_FRAMES or cluttering leaderboard density.
 */

export interface WinterFrameVisualSpec {
  id: string;
  name: string;
  rarity: 'rare' | 'legendary' | 'secret';
  ringClass: string;
  badgeText: string;
}

export interface WinterBorderVisualSpec {
  id: string;
  name: string;
  rarity: 'seasonal' | 'rare' | 'legendary';
  outerClass: string;
  containerTintClass: string;
  accentHex: string;
  motif: 'ice' | 'snowflake' | 'glow' | 'candy' | 'gold';
}

export const WINTER_FRAME_VISUALS: Record<string, WinterFrameVisualSpec> = {
  frosted_aurora: {
    id: 'frosted_aurora',
    name: 'Frosted Aurora Ring',
    rarity: 'rare',
    ringClass: 'ring-2 ring-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.48)]',
    badgeText: 'Rare',
  },
  candy_ribbon: {
    id: 'candy_ribbon',
    name: 'Candy Ribbon Frame',
    rarity: 'legendary',
    ringClass: 'ring-2 ring-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.48)]',
    badgeText: 'Legendary',
  },
  starlight_gold: {
    id: 'starlight_gold',
    name: 'Starlight Sleigh Frame',
    rarity: 'legendary',
    ringClass: 'ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.52)]',
    badgeText: 'Legendary',
  },
  aurora_crown: {
    id: 'aurora_crown',
    name: 'Aurora Crown Frame',
    rarity: 'secret',
    ringClass: 'ring-2 ring-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.6)]',
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
  },
  winter_glow_border: {
    id: 'winter_glow_border',
    name: 'Winter Glow Border',
    rarity: 'rare',
    outerClass:
      'p-[3px] rounded-full bg-gradient-to-tr from-teal-400 via-sky-400 to-indigo-400 shadow-[0_0_16px_rgba(34,211,238,0.55)]',
    containerTintClass: 'border-teal-300/60 bg-teal-500/10',
    accentHex: '#22d3ee',
    motif: 'glow',
  },
  candy_cane_border: {
    id: 'candy_cane_border',
    name: 'Candy Cane Border',
    rarity: 'rare',
    outerClass:
      'p-[3px] rounded-full bg-[repeating-linear-gradient(135deg,#e11d48_0px,#e11d48_5px,#ffffff_5px,#ffffff_10px)] shadow-[0_0_14px_rgba(244,63,94,0.45)]',
    containerTintClass: 'border-rose-400/60 bg-rose-500/10',
    accentHex: '#fb7185',
    motif: 'candy',
  },
  golden_festival_border: {
    id: 'golden_festival_border',
    name: 'Golden Festival Border',
    rarity: 'legendary',
    outerClass:
      'p-[3px] rounded-full bg-gradient-to-tr from-amber-500 via-yellow-200 to-orange-500 shadow-[0_0_18px_rgba(251,191,36,0.58)]',
    containerTintClass: 'border-amber-400/70 bg-amber-500/10',
    accentHex: '#fbbf24',
    motif: 'gold',
  },
};

export function getWinterFrameVisual(frameId?: string | null): WinterFrameVisualSpec | null {
  if (!frameId) return null;
  return WINTER_FRAME_VISUALS[frameId] || null;
}

export function getWinterBorderVisual(borderId?: string | null): WinterBorderVisualSpec | null {
  if (!borderId) return null;
  return WINTER_BORDER_VISUALS[borderId] || null;
}
