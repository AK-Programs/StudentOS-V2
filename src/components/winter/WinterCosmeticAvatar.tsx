/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stackable Avatar Renderer:
 * Combines an optional outer Winter Border + an inner Frame (Winter Frame or permanent ProfileFrameStyle)
 * around the user's photo or initials without breaking existing layouts.
 */

import React from 'react';
import { getWinterBorderVisual, getWinterFrameVisual } from '../../lib/winterCosmetics';

export type AvatarCosmeticSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface WinterCosmeticAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  equippedBorder?: string | null;
  equippedFrame?: string | null;
  permanentFrameClass?: string | null;
  size?: AvatarCosmeticSize;
  className?: string;
  fallbackBgClass?: string;
}

const SIZE_CLASSES: Record<AvatarCosmeticSize, { inner: string; text: string; corner: number }> = {
  xs: { inner: 'w-8 h-8', text: 'text-[11px]', corner: 11 },
  sm: { inner: 'w-9 h-9', text: 'text-xs', corner: 12 },
  md: { inner: 'w-12 h-12', text: 'text-sm', corner: 14 },
  lg: { inner: 'w-16 h-16', text: 'text-lg', corner: 16 },
  xl: { inner: 'w-24 h-24', text: 'text-3xl', corner: 20 },
};

const BorderMotifCorner: React.FC<{ motif: 'ice' | 'snowflake' | 'glow' | 'candy' | 'gold'; accentHex: string; size: number }> = ({
  motif,
  accentHex,
  size,
}) => {
  return (
    <span
      className="pointer-events-none absolute -top-1 -right-1 rounded-full bg-slate-950 border border-white/25 flex items-center justify-center shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {motif === 'snowflake' || motif === 'ice' ? (
        <svg viewBox="0 0 16 16" className="w-[70%] h-[70%]" fill="none" stroke={accentHex} strokeWidth="1.6" strokeLinecap="round">
          <line x1="8" y1="2" x2="8" y2="14" />
          <line x1="2.8" y1="5" x2="13.2" y2="11" />
          <line x1="13.2" y1="5" x2="2.8" y2="11" />
        </svg>
      ) : motif === 'gold' ? (
        <svg viewBox="0 0 16 16" className="w-[72%] h-[72%]" fill={accentHex}>
          <path d="M8 1.5l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 10.9 4.3 13l.8-4.2L2 5.9l4.2-.5L8 1.5z" />
        </svg>
      ) : motif === 'candy' ? (
        <span
          className="w-[65%] h-[65%] rounded-full block"
          style={{
            background: 'repeating-linear-gradient(135deg, #f43f5e 0 2px, #ffffff 2px 4px)',
          }}
        />
      ) : (
        <span
          className="w-[60%] h-[60%] rounded-full block"
          style={{ backgroundColor: accentHex }}
        />
      )}
    </span>
  );
};

export const WinterCosmeticAvatar: React.FC<WinterCosmeticAvatarProps> = ({
  name,
  avatarUrl,
  equippedBorder,
  equippedFrame,
  permanentFrameClass,
  size = 'sm',
  className = '',
  fallbackBgClass = 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100',
}) => {
  const borderSpec = getWinterBorderVisual(equippedBorder);
  const winterFrameSpec = getWinterFrameVisual(equippedFrame);
  const dim = SIZE_CLASSES[size];

  const innerFrameClass = winterFrameSpec?.ringClass || permanentFrameClass || '';
  const displayName = (name || 'Member').trim();
  const initials = displayName.slice(0, size === 'xl' ? 1 : 2).toUpperCase();
  const hasPhoto = Boolean(avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:image')));

  const avatarNode = (
    <div
      className={`${dim.inner} rounded-full flex items-center justify-center font-bold overflow-hidden ${fallbackBgClass} ${innerFrameClass}`}
    >
      {hasPhoto ? (
        <img
          src={avatarUrl as string}
          alt={displayName}
          className="w-full h-full object-cover rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className={dim.text}>{initials}</span>
      )}
    </div>
  );

  if (!borderSpec) {
    return <div className={`relative inline-flex shrink-0 ${className}`}>{avatarNode}</div>;
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${borderSpec.outerClass} ${className}`}
      title={`${borderSpec.name}${winterFrameSpec ? ` + ${winterFrameSpec.name}` : ''}`}
    >
      <div className="rounded-full p-[1.5px] bg-slate-950/90 flex items-center justify-center">
        {avatarNode}
      </div>
      <BorderMotifCorner motif={borderSpec.motif} accentHex={borderSpec.accentHex} size={dim.corner} />
    </div>
  );
};
