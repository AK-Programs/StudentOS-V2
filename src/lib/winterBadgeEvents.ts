/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persistent Per-User Winter Badge Unlock Event Diffing & Queue Dispatcher
 * - Tracks seen badge IDs per user in localStorage so logins & page reloads
 *   NEVER replay historical unlocks.
 * - Detects genuine new badge unlocks across tasks, quizzes, Santa gifts,
 *   Spin Wheel outcomes, and status refreshes, queuing the celebration modal
 *   while always surfacing an accessible showNotification toast fallback.
 */

import {
  BadgeUnlockPayload,
  markBadgeAsCelebrated,
  triggerBadgeUnlockCelebration,
} from '../components/winter/BadgeUnlockCelebrationModal';
import { WinterBadgeItem } from './winterFestivalService';

const SEEN_BADGES_KEY_PREFIX = 'veylentra_seen_winter_badges_';

const FALLBACK_BADGE_META: Record<
  string,
  { name: string; rarity: BadgeUnlockPayload['rarity']; description: string; purpose: string }
> = {
  snowflake_explorer: {
    name: 'Snowflake Explorer',
    rarity: 'seasonal',
    description: 'Stepped into the campus Winter Festival Celebration.',
    purpose: 'Displayed on Profile Badge Showcase & Chat Public Profile',
  },
  winter_scholar: {
    name: 'Winter Scholar',
    rarity: 'seasonal',
    description: 'Aced the 3-question Winter Science & Knowledge Check.',
    purpose: 'Displayed on Profile Badge Showcase & Chat Public Profile',
  },
  frosty_focus: {
    name: 'Frosty Focus',
    rarity: 'rare',
    description: 'Maintained real academic momentum throughout the winter season.',
    purpose: 'Displayed on Profile Badge Showcase & Chat Public Profile',
  },
  cookie_collector: {
    name: 'Cookie Jar Curator',
    rarity: 'rare',
    description: 'Collected at least 5 festive Winter Cookies.',
    purpose: 'Displayed on Profile Badge Showcase & Chat Public Profile',
  },
  winter_champion: {
    name: 'Solstice Celebrant',
    rarity: 'rare',
    description: 'Participated in either the Winter Spin Wheel or Nightly Santa Gift.',
    purpose: 'Displayed on Profile Badge Showcase & Chat Public Profile',
  },
  frost_starter: {
    name: 'Frost Starter Badge',
    rarity: 'seasonal',
    description: 'Stepped into the Veylentra Winter Festival and claimed the opening welcome gift.',
    purpose: 'First step into the Winter Festival',
  },
  study_spark: {
    name: 'Winter Scholar Badge',
    rarity: 'rare',
    description: 'Completed an academic study milestone during Winter Festival.',
    purpose: 'Combines Winter participation with academic mastery',
  },
  snowflake_collector: {
    name: 'Snowflake Collector Badge',
    rarity: 'seasonal',
    description: 'Completed the Winter Knowledge Check and demonstrated seasonal spirit.',
    purpose: 'Recognizes seasonal trivia mastery',
  },
  cocoa_baker: {
    name: 'Cocoa Connoisseur Badge',
    rarity: 'rare',
    description: 'Collected at least 5 Winter Cookies from seasonal activities.',
    purpose: 'Celebrates sustained seasonal engagement',
  },
  winter_wheel_ace: {
    name: 'Frost Wheel Ace',
    rarity: 'legendary',
    description: 'Landed cleanly on the Frost Jackpot slice of the Winter Spin Wheel.',
    purpose: 'Signature Spin Wheel jackpot collectible',
  },
  sleigh_keeper: {
    name: 'Sleigh Keeper',
    rarity: 'legendary',
    description: 'Unwrapped a Legendary Starlight Sleigh Crate during the 7–9 PM window.',
    purpose: 'Prestigious seasonal profile merit badge',
  },
  aurora_miracle: {
    name: 'Aurora Miracle',
    rarity: 'legendary',
    description: 'Discovered the 4% Aurora Crown Vault during the Nightly Santa window.',
    purpose: 'Pinnacle Winter Festival Vault collectible',
  },
  north_star_secret: {
    name: 'North Star Secret',
    rarity: 'secret',
    description: 'Unlocked by gathering 15+ Winter Cookies and completing 3+ Winter Festival Tasks.',
    purpose: 'Hidden achievement for Winter masters',
  },
};

const sessionProcessedByUser = new Map<string, Set<string>>();

function getStorageKey(userId: string): string {
  return `${SEEN_BADGES_KEY_PREFIX}${userId}`;
}

function readPersistedSeenSet(userId: string): { initialized: boolean; set: Set<string> } {
  const sessionSet = sessionProcessedByUser.get(userId);
  if (typeof window === 'undefined') {
    return { initialized: Boolean(sessionSet), set: new Set(sessionSet || []) };
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (raw === null) {
      return { initialized: false, set: new Set(sessionSet || []) };
    }
    const parsed = JSON.parse(raw);
    const merged = new Set<string>(Array.isArray(parsed) ? parsed.map(String) : []);
    if (sessionSet) {
      sessionSet.forEach(id => merged.add(id));
    }
    return { initialized: true, set: merged };
  } catch {
    return { initialized: Boolean(sessionSet), set: new Set(sessionSet || []) };
  }
}

function writePersistedSeenSet(userId: string, set: Set<string>): void {
  sessionProcessedByUser.set(userId, new Set(set));
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage quota issues safely
  }
}

function resolveBadgeMetadata(
  badgeId: string,
  catalog?: WinterBadgeItem[] | null
): BadgeUnlockPayload {
  const fromCatalog = Array.isArray(catalog) ? catalog.find(b => b.id === badgeId) : undefined;
  const fallback = FALLBACK_BADGE_META[badgeId];
  const rawRarity = String(fromCatalog?.rarity || fallback?.rarity || 'seasonal').toLowerCase();
  const normalizedRarity: BadgeUnlockPayload['rarity'] =
    rawRarity === 'legendary' || rawRarity === 'rare' || rawRarity === 'secret' || rawRarity === 'common'
      ? rawRarity
      : 'seasonal';

  const displayName =
    (fromCatalog && !fromCatalog.isHiddenUntilUnlocked ? fromCatalog.name : undefined) ||
    fromCatalog?.name ||
    fallback?.name ||
    badgeId
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  return {
    badgeId,
    badgeName: displayName,
    rarity: normalizedRarity,
    description: fromCatalog?.description || fallback?.description,
    purpose: fromCatalog?.purpose || fallback?.purpose,
  };
}

/**
 * Seeds the per-user seen-badges store on initial hydration so existing badges
 * never trigger false celebration popups on login or browser refresh.
 */
export function syncWinterBadgeBaseline(
  userId?: string | null,
  earnedWinterBadges?: Record<string, string> | null
): void {
  if (!userId) return;
  const { initialized, set } = readPersistedSeenSet(userId);
  if (initialized) return;

  const badgeIds = Object.keys(earnedWinterBadges || {});
  for (const id of badgeIds) {
    set.add(id);
    markBadgeAsCelebrated(id, userId);
  }
  writePersistedSeenSet(userId, set);
}

/**
 * Diffs newly earned Winter badges against the user's persisted seen set.
 * Newly unlocked badges enqueue the BadgeUnlockCelebrationModal AND fire
 * showNotification as an accessible toast fallback (especially for reduced motion).
 */
export function processNewWinterBadges(params: {
  userId?: string | null;
  earnedWinterBadges?: Record<string, string> | null;
  badgesCatalog?: WinterBadgeItem[] | null;
  showNotification?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  silentOnFirstBaseline?: boolean;
}): BadgeUnlockPayload[] {
  const { userId, earnedWinterBadges, badgesCatalog, showNotification, silentOnFirstBaseline = true } = params;
  if (!userId || !earnedWinterBadges || typeof earnedWinterBadges !== 'object') return [];

  const earnedIds = Object.keys(earnedWinterBadges).filter(Boolean);
  if (earnedIds.length === 0) return [];

  const { initialized, set } = readPersistedSeenSet(userId);

  // If this user has never been baselined on this browser and silentOnFirstBaseline is set,
  // treat current earned badges as already seen so logins/refreshes never replay old unlocks.
  if (!initialized && silentOnFirstBaseline) {
    for (const id of earnedIds) {
      set.add(id);
      markBadgeAsCelebrated(id, userId);
    }
    writePersistedSeenSet(userId, set);
    return [];
  }

  const newlyUnlocked: BadgeUnlockPayload[] = [];
  for (const badgeId of earnedIds) {
    if (set.has(badgeId)) continue;
    set.add(badgeId);
    const payload = { ...resolveBadgeMetadata(badgeId, badgesCatalog), userId };
    newlyUnlocked.push(payload);
  }

  if (newlyUnlocked.length > 0) {
    writePersistedSeenSet(userId, set);
    for (const payload of newlyUnlocked) {
      triggerBadgeUnlockCelebration(payload);
      showNotification?.(
        `New Winter Badge Unlocked: ${payload.badgeName}!`,
        'success'
      );
    }
  }

  return newlyUnlocked;
}
