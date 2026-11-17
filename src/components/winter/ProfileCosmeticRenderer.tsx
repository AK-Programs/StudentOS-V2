/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centralized Profile Cosmetic Renderer (Single Source of Truth):
 * 1. ProfileBannerBackdrop: background identity artwork rendered BEHIND/AROUND the avatar/header.
 * 2. ProfileCosmeticAvatar: avatar image/initials with perimeter-aligned Winter Border or permanent frame.
 * 3. ProfileCosmeticCard: unified Banner + Avatar + Badges composite header.
 *
 * Performance:
 * - Compositor-only transform/opacity animations
 * - IntersectionObserver pauses offscreen VFX (.veylentra-vfx-paused)
 * - Respects prefers-reduced-motion automatically via CSS
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  WinterBannerVisualSpec,
  getWinterBannerVisual,
  getWinterBorderVisual,
} from '../../lib/winterCosmetics';

export type CosmeticAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type CosmeticAvatarShape = 'circle' | 'rounded';

const SIZE_MAP: Record<CosmeticAvatarSize, { box: string; text: string; corner: number }> = {
  xs: { box: 'w-8 h-8', text: 'text-[11px]', corner: 11 },
  sm: { box: 'w-9 h-9', text: 'text-xs', corner: 12 },
  md: { box: 'w-12 h-12', text: 'text-sm', corner: 14 },
  lg: { box: 'w-16 h-16', text: 'text-lg', corner: 16 },
  xl: { box: 'w-24 h-24', text: 'text-3xl', corner: 20 },
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

const BannerSvgArtOverlay: React.FC<{ spec: WinterBannerVisualSpec }> = ({ spec }) => {
  switch (spec.vfxType) {
    case 'aurora':
      return (
        <svg className="w-full h-full opacity-55" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="vyl-aur" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#34d399" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path d="M0,75 Q95,20 190,55 T380,35 L400,35 L400,120 L0,120 Z" fill="url(#vyl-aur)" />
          <path d="M0,95 Q130,35 260,72 T400,48 L400,120 L0,120 Z" fill="#06b6d4" fillOpacity="0.18" />
        </svg>
      );
    case 'starlight':
      return (
        <svg className="w-full h-full opacity-80" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <g fill="#fde68a">
            <circle cx="48" cy="24" r="1.7" />
            <circle cx="118" cy="48" r="1.2" />
            <circle cx="182" cy="18" r="2" />
            <circle cx="248" cy="36" r="1.4" />
            <circle cx="312" cy="22" r="2.1" />
            <circle cx="362" cy="54" r="1.3" />
            <path d="M182 12 L183.6 16.4 L188 18 L183.6 19.6 L182 24 L180.4 19.6 L176 18 L180.4 16.4 Z" />
            <path d="M312 16 L313.5 20.5 L318 22 L313.5 23.5 L312 28 L310.5 23.5 L306 22 L310.5 20.5 Z" />
          </g>
        </svg>
      );
    case 'crown':
      return (
        <svg className="w-full h-full opacity-70" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M40,95 Q200,12 360,95"
            fill="none"
            stroke="#67e8f9"
            strokeOpacity="0.5"
            strokeWidth="1.8"
            strokeDasharray="4 5"
          />
          <polygon points="200,14 205,26 195,26" fill="#a5f3fc" fillOpacity="0.7" />
          <polygon points="150,24 154,34 146,34" fill="#38bdf8" fillOpacity="0.5" />
          <polygon points="250,24 254,34 246,34" fill="#38bdf8" fillOpacity="0.5" />
        </svg>
      );
    case 'snowfall':
      return (
        <svg className="w-full h-full opacity-75" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <g fill="#e0f2fe" fillOpacity="0.65">
            <circle cx="34" cy="22" r="2.2" />
            <circle cx="94" cy="64" r="1.5" />
            <circle cx="152" cy="30" r="2.6" />
            <circle cx="215" cy="76" r="1.8" />
            <circle cx="274" cy="28" r="2.4" />
            <circle cx="332" cy="62" r="1.6" />
            <circle cx="378" cy="26" r="2.1" />
          </g>
        </svg>
      );
    case 'hearth':
      return (
        <svg className="w-full h-full opacity-65" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,120 L0,88 L38,60 L72,92 L120,52 L168,94 L220,66 L278,96 L332,58 L400,92 L400,120 Z" fill="#091526" fillOpacity="0.55" />
          <circle cx="88" cy="48" r="18" fill="#fbbf24" fillOpacity="0.22" />
        </svg>
      );
    case 'peppermint':
    default:
      return (
        <svg className="w-full h-full opacity-55" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <line x1="-20" y1="120" x2="100" y2="0" stroke="#fda4af" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="120" y1="120" x2="240" y2="0" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.3" />
          <line x1="260" y1="120" x2="380" y2="0" stroke="#fda4af" strokeWidth="1.5" strokeOpacity="0.4" />
        </svg>
      );
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
            className={`pointer-events-none absolute inset-0 ${bannerSpec.vfxClass}`}
            style={{ background: bannerSpec.overlayGradient }}
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <BannerSvgArtOverlay spec={bannerSpec} />
          </div>
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
  const outerBorderClasses = borderSpec
    ? borderSpec.outerClass.replace(/rounded-full/g, radiusClass)
    : '';

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
      className={`relative inline-flex items-center justify-center shrink-0 ${outerBorderClasses} ${borderSpec.ringAnimClass} ${paused ? 'veylentra-vfx-paused' : ''} ${className}`}
      title={borderSpec.name}
      data-winter-border={borderSpec.id}
    >
      <div className={`${radiusClass} p-[1.5px] bg-slate-950/90 flex items-center justify-center`}>
        {avatarNode}
      </div>
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
