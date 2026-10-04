import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, ArrowRight, Sparkles, Palette, Rocket } from 'lucide-react';
import { PromotionalBanner, getActivePromotionalBanners } from '../config/promotionalBanners';

interface PromotionalBannersProps {
  onNavigateTab?: (tab: string, subtab?: string) => void;
  className?: string;
}

export const PromotionalBanners: React.FC<PromotionalBannersProps> = ({
  onNavigateTab,
  className = ''
}) => {
  const [activeBanners, setActiveBanners] = useState<PromotionalBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef<any>(null);

  // Check reduced motion preference
  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } catch (_) {}
  }, []);

  // Filter active banners within time window
  useEffect(() => {
    const banners = getActivePromotionalBanners();
    setActiveBanners(banners);
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (activeBanners.length <= 1 || isPaused || isDismissed) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activeBanners.length);
    }, 7000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeBanners.length, isPaused, isDismissed]);

  if (isDismissed || activeBanners.length === 0) {
    return null;
  }

  const currentBanner = activeBanners[currentIndex];
  if (!currentBanner) return null;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % activeBanners.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  const handleCtaClick = () => {
    if (currentBanner.ctaAction === 'navigate_profile_settings_theme') {
      onNavigateTab?.('profile', 'settings_theme');
    } else if (currentBanner.ctaPayload) {
      onNavigateTab?.(currentBanner.ctaPayload);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border bg-gradient-to-r ${currentBanner.gradientClass} ${currentBanner.borderClass} shadow-xl transition-all duration-500 ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="StudentOS Announcements"
    >
      {/* Background Animated Gradient Orb (Respects reduced motion) */}
      <div 
        className={`absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/5 blur-3xl pointer-events-none transition-transform duration-1000 ${
          reducedMotion ? '' : 'animate-pulse'
        }`}
      />

      {/* Dismiss Button */}
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-3.5 right-3.5 z-20 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-slate-400 hover:text-white transition-all text-xs focus:outline-none focus:ring-2 focus:ring-white/20"
        title="Dismiss announcement for session"
        aria-label="Dismiss banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="relative z-10 p-5 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        {/* Left Content Area */}
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl select-none" aria-hidden="true">
              {currentBanner.icon}
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${currentBanner.badgeColor}`}>
              {currentBanner.badgeText}
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {currentBanner.subtitle}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl md:text-2xl font-black font-display text-white tracking-tight leading-snug">
            {currentBanner.title}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
            {currentBanner.description}
          </p>

          <div className="pt-1 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleCtaClick}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 shadow-md backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                reducedMotion ? '' : 'hover:translate-x-0.5'
              }`}
            >
              <span>{currentBanner.ctaText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {/* Carousel navigation controls (if > 1 banner) */}
            {activeBanners.length > 1 && (
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={handlePrev}
                  className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-slate-300 hover:text-white transition-all text-xs"
                  aria-label="Previous announcement"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1 px-1">
                  {activeBanners.map((b, idx) => (
                    <button
                      key={b.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
                <button
                  onClick={handleNext}
                  className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-slate-300 hover:text-white transition-all text-xs"
                  aria-label="Next announcement"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Illustration Icon (Hidden on very small screens, responsive on tablet/desktop) */}
        <div className="hidden md:flex items-center justify-center shrink-0 pr-4">
          <div 
            className={`w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-4xl shadow-2xl transition-transform ${
              reducedMotion ? '' : 'hover:scale-105'
            }`}
          >
            {currentBanner.illustrationType === 'rocket' && (
              <Rocket className="w-10 h-10 text-indigo-300 animate-bounce" style={{ animationDuration: '3s' }} />
            )}
            {currentBanner.illustrationType === 'palette' && (
              <Palette className="w-10 h-10 text-emerald-300 animate-pulse" style={{ animationDuration: '2.5s' }} />
            )}
            {currentBanner.illustrationType === 'sparkles' && (
              <Sparkles className="w-10 h-10 text-amber-300 animate-spin" style={{ animationDuration: '8s' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
