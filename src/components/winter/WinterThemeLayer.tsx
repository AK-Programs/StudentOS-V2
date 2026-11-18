/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reversible Winter Festival Theme Layer & Targeted Snowfall Overlay
 * - Applies isolated `.winter-theme-active` CSS class to `<html>` ONLY while `winter_theme` is accessible
 * - NEVER writes to or overwrites the user's saved `studentos_theme` localStorage preference
 * - Renders GPU/Canvas-managed pointer-events-none snowfall via WinterSnowSystem when `winter_snow_effects` is accessible
 * - Scales down particle count automatically by viewport tier & honors prefers-reduced-motion
 */

import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import { useFeatureAccess } from '../../lib/featureAccessService';
import { getSavedTheme, ThemeId } from '../../lib/themeSystem';
import { WinterSnowSystem } from './WinterSnowSystem';
import { SnowAccumulationCap } from './SnowAccumulationCap';

export const WinterThemeLayer: React.FC<{ currentUser?: Partial<UserProfile> | null }> = ({
  currentUser,
}) => {
  const themeAccess = useFeatureAccess('winter_theme', currentUser);
  const snowAccess = useFeatureAccess('winter_snow_effects', currentUser);
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() => {
    const rawTheme = (currentUser as any)?.raw_data?.theme as ThemeId;
    return rawTheme || getSavedTheme();
  });

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail?.themeId) {
        setActiveTheme(e.detail.themeId as ThemeId);
      }
    };
    window.addEventListener('studentos_theme_changed', handleThemeChange);
    return () => {
      window.removeEventListener('studentos_theme_changed', handleThemeChange);
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

  if (!isWinterActive || !snowAccess.accessible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-[5]"
      aria-hidden="true"
    >
      <WinterSnowSystem density="low" variant="full" />
    </div>
  );
};

export const TargetedWinterSnowOverlay: React.FC<{
  variant?: 'hero' | 'card' | 'button';
  enabled?: boolean;
}> = ({ variant = 'card', enabled = true }) => {
  const snowAccess = useFeatureAccess('winter_snow_effects');

  if (!enabled || !snowAccess.accessible) return null;

  return (
    <span
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] z-[1]"
      aria-hidden="true"
    >
      <SnowAccumulationCap variant={variant === 'button' ? 'button' : variant === 'hero' ? 'hero' : 'card'} />
      {variant !== 'button' && (
        <WinterSnowSystem density={variant === 'hero' ? 'medium' : 'low'} variant="subtle" />
      )}
    </span>
  );
};
