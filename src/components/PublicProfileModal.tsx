import React, { useEffect } from 'react';
import { X, MessageSquare, Phone, Video, ShieldCheck, Sparkles, BookOpen, Target, Award, ExternalLink, Calendar } from 'lucide-react';
import { UserProfile, ProfileFrameStyle } from '../types';
import { AVATAR_FRAMES, BANNER_PRESETS, ACCENT_COLORS } from './ProfileCustomizer';
import { getVerificationStatus } from '../lib/verification';

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
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!user) return null;

  // Verification status calculated centrally from actual backend state
  const verification = getVerificationStatus(user);
  const isVerified = verification.isVerified;

  // Profile customization properties
  const rawData = user.raw_data || {};
  const frameStyleId = (user.avatarFrame || rawData.avatarFrame || 'none') as ProfileFrameStyle;
  const activeFrame = AVATAR_FRAMES.find(f => f.id === frameStyleId) || AVATAR_FRAMES[0];
  
  const bannerPresetClass = user.bannerPreset || rawData.bannerPreset || BANNER_PRESETS[0].gradient;
  const bannerUrl = user.bannerUrl || rawData.bannerUrl;
  const photoURL = user.photoURL || user.avatar || rawData.photoURL;
  const bio = user.bio || rawData.bio || 'StudentOS community member focusing on collaborative learning and academic growth.';
  const pronouns = user.pronouns || rawData.pronouns;
  const customStatus = user.customStatus || rawData.customStatus;
  const accentColorId = user.accentColor || rawData.accentColor || 'indigo';
  const activeAccent = ACCENT_COLORS.find(a => a.id === accentColorId) || ACCENT_COLORS[0];

  // Custom cards saved in user profile
  const customCards: any[] = rawData.customCards || [];

  const isSelf = currentUserId && (user.uid === currentUserId || user.id === currentUserId || user.email === currentUserId);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-profile-title"
    >
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner Area */}
        <div className="relative h-32 sm:h-36 w-full overflow-hidden shrink-0">
          {bannerUrl ? (
            <img 
              src={bannerUrl} 
              alt="Profile banner" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full ${bannerPresetClass} flex items-center justify-center`}>
              <div className="w-full h-full bg-black/10 backdrop-blur-[1px]" />
            </div>
          )}

          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition-all backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Close profile"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Role pill on top banner */}
          <div className="absolute bottom-3 right-4 z-10">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-white border border-white/15 backdrop-blur-md">
              {user.role || 'Student'}
            </span>
          </div>
        </div>

        {/* Profile Content Body (Scrollable) */}
        <div className="relative px-6 pt-0 pb-6 overflow-y-auto space-y-5">
          {/* Avatar with customized frame (Offset to overlap banner) */}
          <div className="-mt-12 flex items-end justify-between gap-4">
            <div className="relative shrink-0">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${activeFrame.className} bg-slate-900`}>
                {photoURL ? (
                  <img 
                    src={photoURL} 
                    alt={user.name || 'User'} 
                    className="w-full h-full rounded-full object-cover bg-slate-950"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-3xl font-black font-display">
                    {(user.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Verified badge tick overlay on avatar */}
              {isVerified && (
                <div 
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg border-2 border-slate-900"
                  title="StudentOS Verified"
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            {!isSelf && (
              <div className="flex items-center gap-2 pb-1">
                {onStartDirectMessage && (
                  <button
                    onClick={() => {
                      onStartDirectMessage(user);
                      onClose();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                )}
                {onStartCall && (
                  <>
                    <button
                      onClick={() => {
                        onStartCall(user, false);
                        onClose();
                      }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 active:scale-95 transition-all"
                      title="Audio Call"
                      aria-label="Audio call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        onStartCall(user, true);
                        onClose();
                      }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 active:scale-95 transition-all"
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

          {/* User Name & Verified Badge Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="public-profile-title" className="text-xl font-black font-display text-white tracking-tight">
                {user.name || 'StudentOS Member'}
              </h2>
              {isVerified && (
                <span 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm"
                  title="Verified StudentOS Account"
                >
                  <ShieldCheck className="w-3 h-3 text-indigo-400" />
                  <span>Verified</span>
                </span>
              )}
              {pronouns && (
                <span className="text-xs text-slate-400 font-mono">
                  ({pronouns})
                </span>
              )}
            </div>

            {/* Custom Status */}
            {customStatus && (
              <p className="text-xs text-indigo-300 font-medium flex items-center gap-1.5">
                <span>💬</span> {customStatus}
              </p>
            )}
          </div>

          {/* Metadata Badges (House, Section, Grade) */}
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            {user.house && (
              <span className={`px-2.5 py-1 rounded-lg font-bold border ${
                user.house === 'Ruby' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                user.house === 'Emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                user.house === 'Sapphire' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                🏰 {user.house} House
              </span>
            )}
            {user.section && (
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-bold">
                Section {user.section}
              </span>
            )}
            {user.grade && (
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-bold">
                Grade {user.grade}
              </span>
            )}
            {user.specialtySubject && (
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold">
                {user.specialtySubject}
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
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1">
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
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium mt-1"
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
              StudentOS Encrypted Public Profile • Safe Academic Network
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
