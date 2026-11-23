import React, { useState } from 'react';
import {
  Code2,
  Cpu,
  MessageSquareQuote,
  Crown,
  Atom,
  Trophy,
  Music,
  Palette,
  BookOpen,
  Sparkles,
  Calendar,
  Camera,
  Newspaper,
  Shield,
  Award,
  Flame,
  Compass,
  Zap,
} from 'lucide-react';

interface CategoryVisualTheme {
  gradient: string;
  accentHex: string;
  secondaryHex: string;
  pattern: 'circuit' | 'grid' | 'waves' | 'orbit' | 'crest';
  Icon: React.FC<{ className?: string }>;
}

const THEME_MAP: Record<string, CategoryVisualTheme> = {
  coding: {
    gradient: 'from-indigo-950 via-slate-900 to-cyan-950',
    accentHex: '#6366f1',
    secondaryHex: '#22d3ee',
    pattern: 'circuit',
    Icon: Code2,
  },
  technology: {
    gradient: 'from-indigo-950 via-slate-900 to-sky-950',
    accentHex: '#6366f1',
    secondaryHex: '#38bdf8',
    pattern: 'circuit',
    Icon: Code2,
  },
  robotics: {
    gradient: 'from-cyan-950 via-slate-900 to-indigo-950',
    accentHex: '#06b6d4',
    secondaryHex: '#818cf8',
    pattern: 'grid',
    Icon: Cpu,
  },
  stem: {
    gradient: 'from-teal-950 via-slate-900 to-indigo-950',
    accentHex: '#14b8a6',
    secondaryHex: '#6366f1',
    pattern: 'grid',
    Icon: Cpu,
  },
  debate: {
    gradient: 'from-purple-950 via-slate-900 to-indigo-950',
    accentHex: '#a855f7',
    secondaryHex: '#818cf8',
    pattern: 'waves',
    Icon: MessageSquareQuote,
  },
  humanities: {
    gradient: 'from-violet-950 via-slate-900 to-slate-950',
    accentHex: '#8b5cf6',
    secondaryHex: '#38bdf8',
    pattern: 'waves',
    Icon: BookOpen,
  },
  chess: {
    gradient: 'from-amber-950 via-slate-900 to-slate-950',
    accentHex: '#f59e0b',
    secondaryHex: '#fbbf24',
    pattern: 'grid',
    Icon: Crown,
  },
  science: {
    gradient: 'from-emerald-950 via-slate-900 to-cyan-950',
    accentHex: '#10b981',
    secondaryHex: '#06b6d4',
    pattern: 'orbit',
    Icon: Atom,
  },
  'science fair': {
    gradient: 'from-emerald-950 via-slate-900 to-teal-950',
    accentHex: '#10b981',
    secondaryHex: '#38bdf8',
    pattern: 'orbit',
    Icon: Atom,
  },
  sports: {
    gradient: 'from-rose-950 via-slate-900 to-amber-950',
    accentHex: '#f43f5e',
    secondaryHex: '#f59e0b',
    pattern: 'waves',
    Icon: Flame,
  },
  arts: {
    gradient: 'from-pink-950 via-slate-900 to-purple-950',
    accentHex: '#ec4899',
    secondaryHex: '#a855f7',
    pattern: 'waves',
    Icon: Palette,
  },
  music: {
    gradient: 'from-fuchsia-950 via-slate-900 to-indigo-950',
    accentHex: '#d946ef',
    secondaryHex: '#6366f1',
    pattern: 'waves',
    Icon: Music,
  },
  'annual day': {
    gradient: 'from-amber-950 via-indigo-950 to-slate-950',
    accentHex: '#f59e0b',
    secondaryHex: '#6366f1',
    pattern: 'orbit',
    Icon: Sparkles,
  },
  trips: {
    gradient: 'from-sky-950 via-slate-900 to-indigo-950',
    accentHex: '#0ea5e9',
    secondaryHex: '#6366f1',
    pattern: 'orbit',
    Icon: Compass,
  },
  competitions: {
    gradient: 'from-indigo-950 via-slate-900 to-amber-950',
    accentHex: '#6366f1',
    secondaryHex: '#f59e0b',
    pattern: 'crest',
    Icon: Trophy,
  },
  'success story': {
    gradient: 'from-indigo-950 via-slate-900 to-emerald-950',
    accentHex: '#6366f1',
    secondaryHex: '#10b981',
    pattern: 'orbit',
    Icon: Newspaper,
  },
  achievement: {
    gradient: 'from-amber-950 via-slate-900 to-indigo-950',
    accentHex: '#f59e0b',
    secondaryHex: '#6366f1',
    pattern: 'crest',
    Icon: Award,
  },
  events: {
    gradient: 'from-sky-950 via-slate-900 to-purple-950',
    accentHex: '#38bdf8',
    secondaryHex: '#a855f7',
    pattern: 'grid',
    Icon: Calendar,
  },
  ruby: {
    gradient: 'from-rose-950 via-red-950/80 to-slate-950',
    accentHex: '#ef4444',
    secondaryHex: '#fb7185',
    pattern: 'crest',
    Icon: Shield,
  },
  emerald: {
    gradient: 'from-emerald-950 via-teal-950/80 to-slate-950',
    accentHex: '#10b981',
    secondaryHex: '#34d399',
    pattern: 'crest',
    Icon: Shield,
  },
  sapphire: {
    gradient: 'from-blue-950 via-indigo-950/80 to-slate-950',
    accentHex: '#3b82f6',
    secondaryHex: '#60a5fa',
    pattern: 'crest',
    Icon: Shield,
  },
  topaz: {
    gradient: 'from-amber-950 via-yellow-950/70 to-slate-950',
    accentHex: '#f59e0b',
    secondaryHex: '#fbbf24',
    pattern: 'crest',
    Icon: Shield,
  },
};

const DEFAULT_THEME: CategoryVisualTheme = {
  gradient: 'from-indigo-950 via-slate-900 to-slate-950',
  accentHex: '#6366f1',
  secondaryHex: '#38bdf8',
  pattern: 'grid',
  Icon: Zap,
};

export function resolveCategoryTheme(category?: string): CategoryVisualTheme {
  if (!category) return DEFAULT_THEME;
  const key = category.toLowerCase().trim();
  if (THEME_MAP[key]) return THEME_MAP[key];
  for (const [k, v] of Object.entries(THEME_MAP)) {
    if (key.includes(k)) return v;
  }
  return DEFAULT_THEME;
}

/**
 * Renders crisp Lucide iconography in place of raw unicode emojis while staying backwards-compatible
 * with persisted database emoji tokens.
 */
export const LifeCategoryIcon: React.FC<{
  token?: string;
  category?: string;
  className?: string;
}> = ({ token, category, className = 'w-5 h-5' }) => {
  const t = String(token || '').trim();
  const c = String(category || '').toLowerCase();

  if (t === '🤖' || c.includes('robot') || c.includes('stem')) return <Cpu className={className} />;
  if (t === '💻' || c.includes('cod') || c.includes('tech')) return <Code2 className={className} />;
  if (t === '🧪' || c.includes('science') || c.includes('astro')) return <Atom className={className} />;
  if (t === '🎵' || c.includes('music') || c.includes('band')) return <Music className={className} />;
  if (t === '🎨' || c.includes('art') || c.includes('canvas')) return <Palette className={className} />;
  if (t === '📚' || c.includes('liter') || c.includes('book') || c.includes('human')) return <BookOpen className={className} />;
  if (t === '🏆' || c.includes('perform') || c.includes('comp')) return <Trophy className={className} />;
  if (t === '⭐' || c.includes('attend') || c.includes('discipl')) return <Sparkles className={className} />;
  if (t === '🥇' || c.includes('win')) return <Award className={className} />;
  if (t === '🏃' || c.includes('sport') || c.includes('athl')) return <Flame className={className} />;

  const theme = resolveCategoryTheme(category);
  const ResolvedIcon = theme.Icon;
  return <ResolvedIcon className={className} />;
};

/**
 * Zero-Broken-Image Campus Cover Artwork.
 * Always renders a rich vector geometric dark-academic stage; optionally layers a valid
 * remote cover URL on top and falls back cleanly if the image fails or is offline.
 */
export const CampusCoverArtwork: React.FC<{
  category?: string;
  title?: string;
  imageUrl?: string;
  className?: string;
  variantSeed?: number;
  compact?: boolean;
}> = ({ category, title, imageUrl, className = '', variantSeed = 0, compact = false }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const theme = resolveCategoryTheme(category);
  const IconComp = theme.Icon;
  const shouldLoadExternal = Boolean(
    imageUrl &&
      imageUrl.trim().length > 0 &&
      !imageUrl.includes('images.unsplash.com') &&
      !imgError
  );

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${theme.gradient} select-none ${className}`}
      aria-label={title ? `${title} visual backdrop` : 'Campus cover artwork'}
    >
      {/* Radial depth bloom */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${25 + (variantSeed * 17) % 55}% 30%, ${theme.accentHex}38, transparent 65%), radial-gradient(circle at 80% 85%, ${theme.secondaryHex}28, transparent 60%)`,
        }}
      />

      {/* Precision SVG geometric blueprint pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {theme.pattern === 'circuit' && (
          <g stroke={theme.secondaryHex} strokeWidth="1" fill="none">
            <path d="M0 40 H110 L135 65 H260" />
            <path d="M400 140 H280 L250 110 H120" />
            <circle cx="135" cy="65" r="3.5" fill={theme.accentHex} />
            <circle cx="260" cy="65" r="3.5" fill={theme.secondaryHex} />
            <circle cx="250" cy="110" r="3.5" fill={theme.accentHex} />
            <rect x="300" y="26" width="54" height="32" rx="6" />
          </g>
        )}
        {theme.pattern === 'orbit' && (
          <g stroke={theme.accentHex} strokeWidth="1" fill="none">
            <circle cx="310" cy="100" r="78" strokeDasharray="4 6" />
            <circle cx="310" cy="100" r="46" />
            <circle cx="90" cy="160" r="64" stroke={theme.secondaryHex} strokeDasharray="3 5" />
          </g>
        )}
        {theme.pattern === 'grid' && (
          <g stroke={theme.accentHex} strokeWidth="0.8" fill="none">
            <line x1="0" y1="50" x2="400" y2="50" />
            <line x1="0" y1="100" x2="400" y2="100" />
            <line x1="0" y1="150" x2="400" y2="150" />
            <line x1="100" y1="0" x2="100" y2="200" />
            <line x1="200" y1="0" x2="200" y2="200" />
            <line x1="300" y1="0" x2="300" y2="200" />
          </g>
        )}
        {theme.pattern === 'waves' && (
          <g stroke={theme.secondaryHex} strokeWidth="1.2" fill="none">
            <path d="M0 120 Q100 70 200 120 T400 120" />
            <path d="M0 148 Q100 98 200 148 T400 148" stroke={theme.accentHex} />
          </g>
        )}
        {theme.pattern === 'crest' && (
          <g stroke={theme.accentHex} strokeWidth="1.2" fill="none">
            <polygon points="320,24 368,46 368,108 320,148 272,108 272,46" />
            <polygon points="320,40 354,56 354,102 320,132 286,102 286,56" stroke={theme.secondaryHex} />
          </g>
        )}
      </svg>

      {/* Center / Corner Editorial Emblem */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <div
          className={`rounded-2xl border border-white/15 bg-slate-950/55 backdrop-blur-md flex items-center justify-center shadow-lg ${
            compact ? 'p-2.5' : 'p-4'
          }`}
        >
          <IconComp className={`${compact ? 'w-5 h-5' : 'w-7 h-7'} text-white/90`} />
        </div>
      </div>

      {/* Optional custom external image layer with zero-broken-image fallback */}
      {shouldLoadExternal && (
        <img
          src={imageUrl}
          alt={title || category || 'Campus media'}
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            imgLoaded ? 'opacity-85' : 'opacity-0'
          }`}
        />
      )}

      {/* Subtle bottom vignette for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />
    </div>
  );
};

export const GalleryPlaceholderTile: React.FC<{ category?: string; index: number; title?: string }> = ({
  category,
  index,
  title,
}) => (
  <CampusCoverArtwork
    category={category}
    title={title}
    variantSeed={index + 1}
    compact
    className="w-full h-full"
  />
);

export const GalleryIconBadge = Camera;
