/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reversible Winter Festival Theme Layer
 * - Applies isolated `.winter-theme-active` CSS class to `<html>` ONLY while `winter_theme` is accessible
 * - NEVER writes to or overwrites the user's saved `studentos_theme` localStorage preference
 * - Renders GPU-composited pointer-events-none snowflakes when `winter_snow_effects` is accessible
 * - Automatically pauses animations under prefers-reduced-motion
 */

import React, { useEffect, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useFeatureAccess } from '../../lib/featureAccessService';
import { SnowflakeVector } from './WinterArtwork';

interface FlakeSpec {
  id: number;
  leftPercent: number;
  size: number;
  durationSec: number;
  delaySec: number;
  driftPx: number;
  opacity: number;
}

export const WinterThemeLayer: React.FC<{ currentUser?: Partial<UserProfile> | null }> = ({
  currentUser,
}) => {
  const themeAccess = useFeatureAccess('winter_theme', currentUser);
  const snowAccess = useFeatureAccess('winter_snow_effects', currentUser);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (themeAccess.accessible) {
      root.classList.add('winter-theme-active');
    } else {
      root.classList.remove('winter-theme-active');
    }
    return () => {
      root.classList.remove('winter-theme-active');
    };
  }, [themeAccess.accessible]);

  const flakes = useMemo<FlakeSpec[]>(() => {
    return Array.from({ length: 16 }).map((_, idx) => ({
      id: idx,
      leftPercent: ((idx * 6.4) + 3) % 97,
      size: 10 + (idx % 4) * 3,
      durationSec: 12 + (idx % 5) * 3.2,
      delaySec: -((idx * 1.9) % 14),
      driftPx: idx % 2 === 0 ? 22 + (idx % 3) * 8 : -(18 + (idx % 3) * 8),
      opacity: 0.25 + (idx % 3) * 0.14,
    }));
  }, []);

  if (!themeAccess.accessible || !snowAccess.accessible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-[5]"
      aria-hidden="true"
    >
      {flakes.map((flake) => (
        <div
          key={flake.id}
          className="veylentra-snowflake text-sky-200/80"
          style={
            {
              left: `${flake.leftPercent}%`,
              '--flake-duration': `${flake.durationSec}s`,
              '--flake-delay': `${flake.delaySec}s`,
              '--flake-drift': `${flake.driftPx}px`,
              '--flake-opacity': flake.opacity,
            } as React.CSSProperties
          }
        >
          <SnowflakeVector size={flake.size} className="text-sky-200/80" />
        </div>
      ))}
    </div>
  );
};
