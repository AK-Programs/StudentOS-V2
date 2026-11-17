/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reversible Winter Festival Theme Layer & Targeted Snowfall Overlay
 * - Applies isolated `.winter-theme-active` CSS class to `<html>` ONLY while `winter_theme` is accessible
 * - NEVER writes to or overwrites the user's saved `studentos_theme` localStorage preference
 * - Renders GPU-composited pointer-events-none snowflakes when `winter_snow_effects` is accessible
 * - Scales down particle count automatically on narrow mobile viewports & honors prefers-reduced-motion
 */

import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../../types';
import { useFeatureAccess } from '../../lib/featureAccessService';
import { getSavedTheme, ThemeId } from '../../lib/themeSystem';
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
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() => {
    const rawTheme = (currentUser as any)?.raw_data?.theme as ThemeId;
    return rawTheme || getSavedTheme();
  });
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail?.themeId) {
        setActiveTheme(e.detail.themeId as ThemeId);
      }
    };
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 640);
    };
    window.addEventListener('studentos_theme_changed', handleThemeChange);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('studentos_theme_changed', handleThemeChange);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isWinterActive = themeAccess.accessible && activeTheme === 'winter';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isWinterActive) {
      root.classList.add('winter-theme-active');
    } else {
      root.classList.remove('winter-theme-active');
    }
  }, [isWinterActive]);

  const count = isMobileViewport ? 8 : 16;
  const flakes = useMemo<FlakeSpec[]>(() => {
    return Array.from({ length: count }).map((_, idx) => ({
      id: idx,
      leftPercent: ((idx * (94 / count)) + 3) % 97,
      size: 10 + (idx % 4) * 3,
      durationSec: 12 + (idx % 5) * 3.2,
      delaySec: -((idx * 1.9) % 14),
      driftPx: idx % 2 === 0 ? 22 + (idx % 3) * 8 : -(18 + (idx % 3) * 8),
      opacity: 0.24 + (idx % 3) * 0.12,
    }));
  }, [count]);

  if (!isWinterActive || !snowAccess.accessible) {
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

export const TargetedWinterSnowOverlay: React.FC<{
  variant?: 'hero' | 'card' | 'button';
  enabled?: boolean;
}> = ({ variant = 'card', enabled = true }) => {
  const snowAccess = useFeatureAccess('winter_snow_effects');

  const specs = useMemo(() => {
    const count = variant === 'hero' ? 9 : variant === 'card' ? 5 : 4;
    return Array.from({ length: count }).map((_, idx) => ({
      id: idx,
      left: `${((idx * 91) / count + 6) % 94}%`,
      size: variant === 'button' ? 9 : 10 + (idx % 3) * 2,
      delay: `${-((idx * 1.4) % 5)}s`,
      duration: `${6 + (idx % 3) * 2}s`,
      opacity: variant === 'button' ? 0.35 : 0.42,
    }));
  }, [variant]);

  if (!enabled || !snowAccess.accessible) return null;

  return (
    <span
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] z-[1]"
      aria-hidden="true"
    >
      <span className="pointer-events-none absolute inset-x-3 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-sky-200/65 to-transparent" />
      {specs.map((f) => (
        <span
          key={f.id}
          className="veylentra-vfx-starlight absolute text-sky-200/70"
          style={{
            left: f.left,
            top: `${12 + (f.id % 3) * 22}%`,
            animationDelay: f.delay,
            animationDuration: f.duration,
            opacity: f.opacity,
          }}
        >
          <SnowflakeVector size={f.size} className="text-sky-200/80" />
        </span>
      ))}
    </span>
  );
};
