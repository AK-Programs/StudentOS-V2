export interface PromotionalBanner {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  ctaText: string;
  ctaAction: string; // Tab to navigate or action key
  ctaPayload?: any;
  startTime: string; // ISO 8601 string
  endTime: string;   // ISO 8601 string
  active: boolean;
  gradientClass: string;
  borderClass: string;
  badgeText: string;
  badgeColor: string;
  icon: string;
  illustrationType: 'rocket' | 'palette' | 'sparkles';
}

/**
 * Exactly 3 limited-time promotional/informational banners for StudentOS.
 * Configured with strict ISO start and end timestamps.
 * If the current time is before startTime or after endTime, or active is false,
 * the banner will NOT render.
 */
export const PROMOTIONAL_BANNERS: PromotionalBanner[] = [
  {
    id: 'studentos-2-launch',
    title: 'StudentOS 2.0 — The New Student Experience',
    subtitle: 'Major Platform Upgrade',
    description: 'Unified gradebook, real-time interactive classrooms, and multi-platform native PWA/APK sync are now live.',
    ctaText: 'Explore Features',
    ctaAction: 'navigate',
    ctaPayload: 'dashboard',
    startTime: '2026-09-01T00:00:00Z',
    endTime: '2026-10-31T23:59:59Z',
    active: true,
    gradientClass: 'from-indigo-950 via-slate-900 to-purple-950',
    borderClass: 'border-indigo-500/30 hover:border-indigo-400/50',
    badgeText: 'Version 2.0 Live',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    icon: '🚀',
    illustrationType: 'rocket'
  },
  {
    id: 'themes-studio-launch',
    title: 'Explore the New StudentOS Themes',
    subtitle: 'System-Wide Personalization',
    description: 'Switch between Midnight Void (AMOLED), Abyssal Ocean, Nordic Aurora, and Editorial Light directly in Settings.',
    ctaText: 'Open Theme Studio',
    ctaAction: 'navigate_profile_settings_theme',
    ctaPayload: 'profile',
    startTime: '2026-09-10T00:00:00Z',
    endTime: '2026-11-15T23:59:59Z',
    active: true,
    gradientClass: 'from-emerald-950 via-slate-900 to-teal-950',
    borderClass: 'border-emerald-500/30 hover:border-emerald-400/50',
    badgeText: 'New Themes',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: '🎨',
    illustrationType: 'palette'
  },
  {
    id: 'ai-buddy-smarter-meet',
    title: 'Meet the Smarter StudentOS AI Buddy',
    subtitle: 'Socratic Tutor & Study Engine',
    description: 'Instant step-by-step math solver, academic voice assistant, and automated homework breakdown powered by Gemini.',
    ctaText: 'Launch AI Buddy',
    ctaAction: 'navigate',
    ctaPayload: 'jarvis',
    startTime: '2026-09-15T00:00:00Z',
    endTime: '2026-12-31T23:59:59Z',
    active: true,
    gradientClass: 'from-amber-950 via-slate-900 to-rose-950',
    borderClass: 'border-amber-500/30 hover:border-amber-400/50',
    badgeText: 'AI Powered',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: '✨',
    illustrationType: 'sparkles'
  }
];

/**
 * Returns currently valid active banners within their time-window.
 */
export function getActivePromotionalBanners(now: Date = new Date()): PromotionalBanner[] {
  const currentTime = now.getTime();

  return PROMOTIONAL_BANNERS.filter(banner => {
    if (!banner.active) return false;
    const start = new Date(banner.startTime).getTime();
    const end = new Date(banner.endTime).getTime();
    return currentTime >= start && currentTime <= end;
  });
}
