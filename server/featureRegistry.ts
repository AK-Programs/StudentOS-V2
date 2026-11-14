/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centralized Extensible Feature & Theme Registry
 * Serves as the canonical catalog for Veylentra's Super Admin Feature & Theme Management Console.
 * Adding new features, themes, or seasonal events requires registering a definition here
 * or registering dynamically at runtime via POST /api/features.
 */

export type FeatureCategory =
  | 'Themes and Appearance'
  | 'Student Features'
  | 'Faculty Features'
  | 'AI Features'
  | 'Gamification'
  | 'Seasonal Events'
  | 'Experimental Features'
  | 'Other Platform Features';

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  'Themes and Appearance',
  'Seasonal Events',
  'Gamification',
  'Student Features',
  'Faculty Features',
  'AI Features',
  'Experimental Features',
  'Other Platform Features',
];

export interface PlatformFeatureDefinition {
  key: string;
  displayName: string;
  description: string;
  category: FeatureCategory;
  defaultEnabled: boolean;
  releaseVersion: string;
  rolloutNote: string;
  isSeasonal: boolean;
  canPreviewBySuperAdmin: boolean;
  dependencies?: string[];
  themeMetadata?: Record<string, any>;
  config?: Record<string, any>;
  legacyFlagKey?: string;
}

export interface PlatformFeatureRecord extends PlatformFeatureDefinition {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

export interface FeatureAuditLogEntry {
  id: string;
  featureKey: string;
  previousEnabled: boolean | null;
  newEnabled: boolean;
  action: 'toggle' | 'register' | 'update_config';
  actorId: string;
  actorName: string;
  actorRole: string;
  reason: string;
  createdAt: string;
}

export const DEFAULT_FEATURE_REGISTRY: PlatformFeatureDefinition[] = [
  // Themes and Appearance
  {
    key: 'winter_theme',
    displayName: 'Winter Festival Theme',
    description:
      'Applies a crisp, frosted-slate & ice-blue winter aesthetic with candy-cane borders, snow rims, and seasonal artwork without altering saved user theme preferences.',
    category: 'Themes and Appearance',
    defaultEnabled: true,
    releaseVersion: '2026.12-Winter',
    rolloutNote: 'Reversible seasonal CSS overlay (.winter-theme-active). Zero overwrite of saved user theme.',
    isSeasonal: true,
    canPreviewBySuperAdmin: true,
    themeMetadata: {
      accent: '#38bdf8',
      secondary: '#e11d48',
      cssClass: 'winter-theme-active',
    },
  },
  {
    key: 'winter_snow_effects',
    displayName: 'Winter Falling Snow Effects',
    description:
      'Lightweight GPU-composited snowflake particles that automatically honor prefers-reduced-motion and stay non-blocking.',
    category: 'Themes and Appearance',
    defaultEnabled: true,
    releaseVersion: '2026.12-Winter',
    rolloutNote: 'Depends on Winter Festival Theme. Uses pointer-events: none and compositor transforms.',
    isSeasonal: true,
    canPreviewBySuperAdmin: true,
    dependencies: ['winter_theme'],
    config: { maxParticles: 16 },
  },

  // Seasonal Events
  {
    key: 'winter_festival_tasks',
    displayName: 'Winter Festival Tasks & Challenges',
    description:
      'Verified seasonal tasks including the 3-question Winter Knowledge Check, academic quests, and cookie milestones.',
    category: 'Seasonal Events',
    defaultEnabled: true,
    releaseVersion: '2026.12-Winter',
    rolloutNote: 'Server-verified task progression and one-time XP/Cookie payouts.',
    isSeasonal: true,
    canPreviewBySuperAdmin: true,
  },
  {
    key: 'winter_badges',
    displayName: 'Winter Collectible Badges',
    description:
      'Seasonal and secret Winter badges stored separately from permanent academic achievement badges.',
    category: 'Seasonal Events',
    defaultEnabled: true,
    releaseVersion: '2026.12-Winter',
    rolloutNote: 'Includes secret collectible reveals and profile frames.',
    isSeasonal: true,
    canPreviewBySuperAdmin: true,
  },
  {
    key: 'winter_santa_gifts',
    displayName: 'Nightly Santa Gift Chest (7–9 PM IST)',
    description:
      'Timed nightly Santa chest open strictly from 7:00 PM to 9:00 PM IST with transparent rarity odds and atomic recovery.',
    category: 'Seasonal Events',
    defaultEnabled: true,
    releaseVersion: '2026.12-Winter',
    rolloutNote: 'Strict server-clock Asia/Kolkata enforcement (19:00–21:00) & 1 claim per user per night.',
    isSeasonal: true,
    canPreviewBySuperAdmin: true,
    config: {
      timeZone: 'Asia/Kolkata',
      windowStartHour: 19,
      windowEndHour: 21,
    },
  },
  {
    key: 'winter_spin_wheel',
    displayName: 'Winter Spin Wheel (2-Hour Cooldown)',
    description:
      'Persistent floating Spin Wheel launcher & SVG wheel with server-enforced 2-hour cooldown and capped AI bonuses.',
    category: 'Seasonal Events',
    defaultEnabled: true,
    releaseVersion: '2026.12-Winter',
    rolloutNote: 'Server chooses winning segmentIndex and enforces 7,200,000 ms cooldown.',
    isSeasonal: true,
    canPreviewBySuperAdmin: true,
    config: {
      cooldownMs: 7200000,
    },
  },

  // Gamification
  {
    key: 'student_xp_leaderboard',
    displayName: 'Student XP Leaderboard',
    description:
      'Separated Student Weekly, Monthly, and All-Time XP rankings with Top-3 podium and level progress.',
    category: 'Gamification',
    defaultEnabled: true,
    releaseVersion: '2026.12-Gamification',
    rolloutNote: 'Strictly separates Student accounts from Faculty accounts and strips private fields.',
    isSeasonal: false,
    canPreviewBySuperAdmin: true,
  },
  {
    key: 'faculty_xp_leaderboard',
    displayName: 'Faculty XP Leaderboard',
    description:
      'Separated Faculty (Teachers, Coordinators, HODs) XP leaderboard rewarding verified teaching engagement.',
    category: 'Gamification',
    defaultEnabled: true,
    releaseVersion: '2026.12-Gamification',
    rolloutNote: 'Strictly excludes students and institutional admin overrides; awards server-verified teaching XP.',
    isSeasonal: false,
    canPreviewBySuperAdmin: true,
  },

  // Core Campus Feature Flags (migrated from legacy schoolSettingsService)
  {
    key: 'ai_buddy',
    displayName: 'Byte & Orion AI Assistant',
    description: 'Curriculum study tutor, math tools, and Orion drafting copilot.',
    category: 'AI Features',
    defaultEnabled: true,
    releaseVersion: '2026.10',
    rolloutNote: 'Core AI workspace module.',
    isSeasonal: false,
    canPreviewBySuperAdmin: true,
    legacyFlagKey: 'aiBuddy',
  },
  {
    key: 'peer_chat',
    displayName: 'Peer & Class Chat Rooms',
    description: 'Direct messages and scoped classroom peer discussion rooms.',
    category: 'Student Features',
    defaultEnabled: true,
    releaseVersion: '2026.10',
    rolloutNote: 'Real-time classroom messaging.',
    isSeasonal: false,
    canPreviewBySuperAdmin: true,
    legacyFlagKey: 'peerChat',
  },
  {
    key: 'whiteboard',
    displayName: 'Classroom Whiteboard',
    description: 'Interactive drawing & diagramming board for lessons.',
    category: 'Faculty Features',
    defaultEnabled: true,
    releaseVersion: '2026.10',
    rolloutNote: 'Faculty & student canvas board.',
    isSeasonal: false,
    canPreviewBySuperAdmin: true,
    legacyFlagKey: 'whiteboard',
  },
  {
    key: 'digital_gradebook',
    displayName: 'Digital Gradebook',
    description: 'Subject marks, evaluations, and analytics.',
    category: 'Faculty Features',
    defaultEnabled: true,
    releaseVersion: '2026.10',
    rolloutNote: 'Connected marks & feedback workflow.',
    isSeasonal: false,
    canPreviewBySuperAdmin: true,
    legacyFlagKey: 'digitalGradebook',
  },
  {
    key: 'digital_report_cards',
    displayName: 'Official Report Cards',
    description: 'Printable formal academic report cards.',
    category: 'Student Features',
    defaultEnabled: true,
    releaseVersion: '2026.10',
    rolloutNote: 'Official term transcript generator.',
    isSeasonal: false,
    canPreviewBySuperAdmin: true,
    legacyFlagKey: 'digitalReportCards',
  },
  {
    key: 'attendance_manager',
    displayName: 'Attendance Manager',
    description: 'Daily cohort attendance marking & audit trails.',
    category: 'Faculty Features',
    defaultEnabled: true,
    releaseVersion: '2026.10',
    rolloutNote: 'Role-scoped attendance register.',
    isSeasonal: false,
    canPreviewBySuperAdmin: true,
    legacyFlagKey: 'attendanceManager',
  },
  {
    key: 'materials_hub',
    displayName: 'Materials & Lecture Notes Hub',
    description: 'Shared class resources and personal lecture notes vault.',
    category: 'Student Features',
    defaultEnabled: true,
    releaseVersion: '2026.10',
    rolloutNote: 'Shared files & personal notes.',
    isSeasonal: false,
    canPreviewBySuperAdmin: true,
    legacyFlagKey: 'materialsHub',
  },
  {
    key: 'scheduled_releases',
    displayName: 'Scheduled Releases & Previews',
    description: 'Beta rollout banners and release scheduling controls.',
    category: 'Experimental Features',
    defaultEnabled: true,
    releaseVersion: '2026.10',
    rolloutNote: 'Super Admin scheduled rollout manager.',
    isSeasonal: false,
    canPreviewBySuperAdmin: true,
    legacyFlagKey: 'scheduledReleases',
  },
];
