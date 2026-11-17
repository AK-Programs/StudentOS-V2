import React, { useCallback, useEffect, useState } from 'react';
import { X, MessageSquare, Phone, Video, ShieldCheck, Sparkles, ExternalLink, Award } from 'lucide-react';
import { UserProfile, ProfileFrameStyle } from '../types';
import { AVATAR_FRAMES, BANNER_PRESETS } from './ProfileCustomizer';
import { getVerificationStatus } from '../lib/verification';
import { PublicWinterCosmetics, fetchPublicWinterCosmetics } from '../lib/winterFestivalService';
import { getWinterBannerVisual, getWinterBorderVisual } from '../lib/winterCosmetics';
import { ProfileBannerBackdrop, ProfileCosmeticAvatar } from './winter/ProfileCosmeticRenderer';

interface PublicProfileModalProps {
  user: UserProfile | any;
  currentUserId?: string;
  onClose: () => void;
  onStartDirectMessage?: (user: any) => void;
  onStartCall?: (user: any, video?: boolean) => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  user,
  currentUserId,
  onClose,
  onStartDirectMessage,
  onStartCall
}) => {
  const [cosmeticsData, setCosmeticsData] = useState<PublicWinterCosmetics | null>(null);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const targetUserId = user?.uid || user?.id || user?.email || '';

  const loadCosmetics = useCallback(() => {
    if (!targetUserId) return;
    let active = true;
    fetchPublicWinterCosmetics(String(targetUserId)).then((cos) => {
      if (active && cos) {
        setCosmeticsData(cos);
      }
    });
    return () => {
      active = false;
    };
  }, [targetUserId]);

  useEffect(() => {
    const cancel = loadCosmetics();
    const handleSync = () => {
      loadCosmetics();
    };
    window.addEventListener('veylentra-winter-updated', handleSync);
    window.addEventListener('veylentra-cosmetics-updated', handleSync);
    window.addEventListener('studentos-profile-updated', handleSync);
    return () => {
      if (cancel) cancel();
      window.removeEventListener('veylentra-winter-updated', handleSync);
      window.removeEventListener('veylentra-cosmetics-updated', handleSync);
      window.removeEventListener('studentos-profile-updated', handleSync);
    };
  }, [loadCosmetics]);

  if (!user) return null;

  const serverPub = cosmeticsData?.publicProfile;
  const mergedUser = {
    ...user,
    ...(serverPub || {}),
    uid: serverPub?.uid || user.uid || user.id,
    name: serverPub?.name || user.name,
    role: serverPub?.role || user.role,
  };

  // Verification status calculated centrally from actual backend state
  const verification = getVerificationStatus(mergedUser);
  const isVerified = verification.isVerified;

  // Profile customization properties (live server profile takes precedence over possibly stale chat list cache)
  const rawData = mergedUser.raw_data || {};
  const frameStyleId = (mergedUser.avatarFrame || rawData.avatarFrame || 'none') as ProfileFrameStyle;
  const activeFrame = AVATAR_FRAMES.find(f => f.id === frameStyleId) || AVATAR_FRAMES[0];

  const bannerPresetClass = mergedUser.bannerPreset || rawData.bannerPreset || BANNER_PRESETS[0].gradient;
  const bannerUrl = mergedUser.bannerUrl || rawData.bannerUrl;
  const photoURL = mergedUser.photoURL || mergedUser.avatar || rawData.photoURL;
  const bio =
    mergedUser.bio ||
    rawData.bio ||
    'StudentOS community member focusing on collaborative learning and academic growth.';
  const pronouns = mergedUser.pronouns || rawData.pronouns;
  const customStatus = mergedUser.customStatus || rawData.customStatus;

  const equippedBanner =
    cosmeticsData?.equippedBanner ??
    mergedUser.equippedBanner ??
    rawData.equippedWinterBanner ??
    null;
  const equippedBorder =
    cosmeticsData?.equippedBorder ??
    mergedUser.equippedBorder ??
    mergedUser.equippedWinterBorder ??
    rawData.equippedWinterBorder ??
    null;

  const bannerSpec = getWinterBannerVisual(equippedBanner);
  const borderSpec = getWinterBorderVisual(equippedBorder);

  const customCards: any[] = rawData.customCards || [];
  const isSelf =
    currentUserId &&
    (mergedUser.uid === currentUserId ||
      mergedUser.id === currentUserId ||
      user?.email === currentUserId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-profile-title"
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Profile Banner Area (Always strictly rendered behind avatar/header) */}
        <ProfileBannerBackdrop
          equippedBanner={equippedBanner}
          bannerUrl={bannerUrl}
          bannerPresetClass={bannerPresetClass}
          className="h-32 sm:h-36 w-full shrink-0"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition-all backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Close profile"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-3 right-4 z-10">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-white border border-white/15 backdrop-blur-md">
              {mergedUser.role || 'Student'}
            </span>
          </div>
        </ProfileBannerBackdrop>

        {/* Profile Content Body (Scrollable) */}
        <div className="relative px-5 sm:px-6 pt-0 pb-6 overflow-y-auto space-y-5">
          {/* Foreground Avatar + Perimeter Border (Offset to overlap banner cleanly) */}
          <div className="-mt-12 flex items-end justify-between gap-4 relative z-10">
            <div className="relative shrink-0">
              <ProfileCosmeticAvatar
                name={mergedUser.name || 'User'}
                avatarUrl={photoURL}
                equippedBorder={equippedBorder}
                permanentFrameClass={activeFrame.className}
                size="xl"
                fallbackBgClass="bg-gradient-to-tr from-sky-600 to-cyan-700 text-white font-black font-display"
              />

              {isVerified && (
                <div
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-lg border-2 border-slate-900 z-20"
                  title="Verified Account"
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
              )}
            </div>

            {!isSelf && (
              <div className="flex items-center gap-2 pb-1">
                {onStartDirectMessage && (
                  <button
                    onClick={() => {
                      onStartDirectMessage(mergedUser);
                      onClose();
                    }}
                    className="px-3.5 py-2 min-h-[40px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                )}
                {onStartCall && (
                  <>
                    <button
                      onClick={() => {
                        onStartCall(mergedUser, false);
                        onClose();
                      }}
                      className="p-2.5 min-w-[40px] min-h-[40px] rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      title="Audio Call"
                      aria-label="Audio call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        onStartCall(mergedUser, true);
                        onClose();
                      }}
                      className="p-2.5 min-w-[40px] min-h-[40px] rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      title="Video Call"
                      aria-label="Video call"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* User Name & Verified Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="public-profile-title" className="text-xl font-black font-display text-white tracking-tight">
                {mergedUser.name || 'StudentOS Member'}
              </h2>
              {isVerified && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm"
                  title="Verified StudentOS Account"
                >
                  <ShieldCheck className="w-3 h-3 text-sky-400" />
                  <span>Verified</span>
                </span>
              )}
              {pronouns && (
                <span className="text-xs text-slate-400 font-mono">
                  ({pronouns})
                </span>
              )}
            </div>

            {customStatus && (
              <p className="text-xs text-sky-300 font-medium flex items-center gap-1.5">
                <span>{customStatus}</span>
              </p>
            )}
          </div>

          {/* Active Winter Cosmetic Attribution */}
          {(bannerSpec || borderSpec || (cosmeticsData && cosmeticsData.badgesCount > 0)) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {bannerSpec && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/25 text-sky-200 font-bold">
                  <Sparkles className="w-3 h-3" /> {bannerSpec.name}
                </span>
              )}
              {borderSpec && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-200 font-bold">
                  ◎ {borderSpec.name}
                </span>
              )}
              {cosmeticsData && cosmeticsData.badgesCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/25 text-amber-200 font-bold tabular-nums">
                  <Award className="w-3 h-3" /> {cosmeticsData.badgesCount} Winter Badges
                </span>
              )}
            </div>
          )}

          {/* Metadata (House, Section, Grade) */}
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            {mergedUser.house && (
              <span className={`px-2.5 py-1 rounded-lg font-bold border ${
                mergedUser.house === 'Ruby' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                mergedUser.house === 'Emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                mergedUser.house === 'Sapphire' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {mergedUser.house} House
              </span>
            )}
            {mergedUser.section && (
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-bold">
                Section {mergedUser.section}
              </span>
            )}
            {mergedUser.grade && (
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-bold">
                Grade {mergedUser.grade}
              </span>
            )}
            {mergedUser.specialtySubject && (
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 font-bold">
                {mergedUser.specialtySubject}
              </span>
            )}
          </div>

          {/* Bio Section */}
          <div className="p-3.5 rounded-2xl bg-black/20 border border-white/5 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              About
            </span>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {bio}
            </p>
          </div>

          {/* Custom Cards Display */}
          {customCards.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Custom Cards
              </span>
              <div className="space-y-2">
                {customCards.filter(c => c.visible !== false).map((card, idx) => (
                  <div
                    key={card.id || idx}
                    className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1 hover:border-white/10 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        {card.icon || '📌'} {card.title}
                      </span>
                      {card.badge && (
                        <span className="text-[9px] px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-mono">
                          {card.badge}
                        </span>
                      )}
                    </div>
                    {card.content && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {card.content}
                      </p>
                    )}
                    {card.link && (
                      <a
                        href={card.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium mt-1"
                      >
                        <span>{card.linkText || 'View Link'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Safe Privacy Assurance Note */}
          <div className="pt-1 text-center">
            <span className="text-[10px] text-slate-500 font-mono">
              Encrypted Public Profile • Safe Academic Network
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
