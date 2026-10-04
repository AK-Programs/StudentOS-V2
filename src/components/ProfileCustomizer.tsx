import React, { useState } from 'react';
import { UserProfile, ProfileFrameStyle } from '../types';
import { supabase } from '../lib/supabase';
import { saveSupabaseUserProfile } from '../lib/supabaseUsers';
import { uploadFileToStorage } from '../lib/storageHelper';
import { 
  Camera, Image, Sparkles, Check, X, Shield, Palette, 
  Smile, User, Award, Eye, Save, AlertCircle, RefreshCw,
  BellRing
} from 'lucide-react';
import { 
  enableOneSignalWebPush, 
  disableOneSignalWebPush, 
  getOneSignalPushStatus 
} from '../lib/oneSignal';

interface ProfileCustomizerProps {
  currentUser: UserProfile;
  onUpdateUser?: (updated: UserProfile) => void;
  onProfileUpdated?: (updated: any) => void;
  onClose?: () => void;
}

// Curated Discord-style banner gradients
export const BANNER_PRESETS = [
  { id: 'preset-midnight', name: 'Midnight Void', gradient: 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900' },
  { id: 'preset-cyberpunk', name: 'Cyberpunk Neon', gradient: 'bg-gradient-to-r from-fuchsia-600 via-purple-700 to-cyan-500' },
  { id: 'preset-emerald', name: 'Emerald Scholar', gradient: 'bg-gradient-to-r from-emerald-800 via-teal-700 to-cyan-800' },
  { id: 'preset-sunset', name: 'Sunset Synthwave', gradient: 'bg-gradient-to-r from-amber-500 via-rose-600 to-purple-800' },
  { id: 'preset-nebula', name: 'Cosmic Nebula', gradient: 'bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-800' },
  { id: 'preset-solar', name: 'Solaris Flame', gradient: 'bg-gradient-to-r from-red-600 via-orange-600 to-yellow-500' },
  { id: 'preset-sapphire', name: 'Sapphire Frost', gradient: 'bg-gradient-to-r from-blue-700 via-sky-600 to-indigo-800' },
  { id: 'preset-onyx', name: 'Deep Onyx', gradient: 'bg-gradient-to-r from-zinc-900 via-neutral-800 to-stone-900' }
];

export const ACCENT_COLORS = [
  { id: 'indigo', name: 'Indigo Pulse', hex: '#6366f1', bg: 'bg-indigo-500', text: 'text-indigo-400' },
  { id: 'emerald', name: 'Emerald Gem', hex: '#10b981', bg: 'bg-emerald-500', text: 'text-emerald-400' },
  { id: 'fuchsia', name: 'Fuchsia Glow', hex: '#d946ef', bg: 'bg-fuchsia-500', text: 'text-fuchsia-400' },
  { id: 'amber', name: 'Topaz Amber', hex: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-400' },
  { id: 'cyan', name: 'Cyber Cyan', hex: '#06b6d4', bg: 'bg-cyan-500', text: 'text-cyan-400' },
  { id: 'ruby', name: 'Ruby Blaze', hex: '#ef4444', bg: 'bg-rose-500', text: 'text-rose-400' },
  { id: 'violet', name: 'Royal Violet', hex: '#8b5cf6', bg: 'bg-violet-500', text: 'text-violet-400' }
];

export const AVATAR_FRAMES: { id: ProfileFrameStyle; name: string; description: string; className: string; previewBorder: string }[] = [
  { id: 'none', name: 'Classic Minimal', description: 'Clean borderless aesthetic', className: 'border-2 border-white/20', previewBorder: 'border-white/20' },
  { id: 'neon-cyber', name: 'Neon Cyber', description: 'High-voltage cyan & purple electric rim', className: 'p-1 rounded-full bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-400/50', previewBorder: 'border-cyan-400' },
  { id: 'gold-championship', name: 'Grand Champion', description: 'Gleaming 24K gilded laurel border', className: 'p-1 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-600 shadow-lg shadow-amber-500/40 ring-2 ring-yellow-400', previewBorder: 'border-amber-400' },
  { id: 'emerald-scholar', name: 'Emerald Scholar', description: 'Verdant gem radiance for top minds', className: 'p-1 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-300 to-green-600 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400', previewBorder: 'border-emerald-400' },
  { id: 'ruby-flame', name: 'Ruby Blaze', description: 'Fiery crimson border with radiant pulse', className: 'p-1 rounded-full bg-gradient-to-tr from-rose-600 via-red-400 to-orange-500 shadow-lg shadow-red-500/40 ring-2 ring-red-400', previewBorder: 'border-red-400' },
  { id: 'sapphire-galaxy', name: 'Cosmic Sapphire', description: 'Deep space galactic shimmer', className: 'p-1 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-400 to-purple-600 shadow-lg shadow-blue-500/30 ring-2 ring-blue-400', previewBorder: 'border-blue-400' },
  { id: 'topaz-spark', name: 'Topaz Lightning', description: 'Crackling kinetic amber aura', className: 'p-1 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-orange-400 shadow-lg shadow-amber-500/30 ring-2 ring-amber-400', previewBorder: 'border-amber-400' },
  { id: 'pixel-retro', name: 'Retro Arcade', description: '8-bit nostalgic pixel border', className: 'p-1 rounded-2xl bg-gradient-to-r from-emerald-400 to-indigo-500 shadow-md ring-2 ring-white/40', previewBorder: 'border-purple-400' },
  { id: 'rainbow-holo', name: 'Prismatic Holo', description: 'Shimmering chromatic prism overlay', className: 'p-1 rounded-full bg-gradient-to-r from-red-500 via-green-500 via-blue-500 to-purple-500 shadow-lg shadow-purple-500/30 ring-2 ring-fuchsia-400', previewBorder: 'border-fuchsia-400' }
];

export function ProfileCustomizer({ currentUser, onUpdateUser, onProfileUpdated, onClose }: ProfileCustomizerProps) {
  // Editing state
  const [photoURL, setPhotoURL] = useState<string>(currentUser.photoURL || currentUser.avatar || '');
  const [bannerUrl, setBannerUrl] = useState<string>(currentUser.bannerUrl || '');
  const [bannerPreset, setBannerPreset] = useState<string>(currentUser.bannerPreset || BANNER_PRESETS[0].gradient);
  const [bio, setBio] = useState<string>(currentUser.bio || '');
  const [pronouns, setPronouns] = useState<string>(currentUser.pronouns || '');
  const [customStatus, setCustomStatus] = useState<string>(currentUser.customStatus || '');
  const [avatarFrame, setAvatarFrame] = useState<ProfileFrameStyle>((currentUser.avatarFrame as ProfileFrameStyle) || 'none');
  const [accentColor, setAccentColor] = useState<string>(currentUser.accentColor || 'indigo');
  
  // OneSignal Web Push state
  const [enableWebPush, setEnableWebPush] = useState<boolean>(() => {
    return Boolean(currentUser.enableWebPush ?? currentUser.raw_data?.enableWebPush ?? false);
  });
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  React.useEffect(() => {
    getOneSignalPushStatus().then((status) => {
      if (status.optedIn) setEnableWebPush(true);
    });
  }, []);

  const handleTogglePush = async (val: boolean) => {
    setPushLoading(true);
    setPushMsg(null);
    if (val) {
      const res = await enableOneSignalWebPush(
        currentUser.uid || currentUser.email,
        currentUser.role,
        {
          house: currentUser.house || 'None',
          grade: currentUser.grade || '10',
          section: currentUser.section || 'A'
        }
      );
      if (res.success && res.optedIn) {
        setEnableWebPush(true);
        setPushMsg('✓ Web push notifications enabled via OneSignal!');
        const updated = {
          ...currentUser,
          enableWebPush: true,
          oneSignalSubscriptionId: res.subscriptionId || currentUser.oneSignalSubscriptionId,
          raw_data: {
            ...(currentUser.raw_data || {}),
            enableWebPush: true,
            oneSignalSubscribed: true,
            oneSignalSubscriptionId: res.subscriptionId
          }
        };
        saveSupabaseUserProfile(updated).catch(() => {});
        onUpdateUser?.(updated);
        onProfileUpdated?.(updated);
        try { localStorage.setItem('s_os_user', JSON.stringify(updated)); } catch (_) {}
      } else {
        setEnableWebPush(false);
        setPushMsg(res.error || 'Notification permission was not granted by browser.');
      }
    } else {
      await disableOneSignalWebPush();
      setEnableWebPush(false);
      setPushMsg('Web push notifications disabled for this device.');
      const updated = {
        ...currentUser,
        enableWebPush: false,
        raw_data: {
          ...(currentUser.raw_data || {}),
          enableWebPush: false,
          oneSignalSubscribed: false
        }
      };
      saveSupabaseUserProfile(updated).catch(() => {});
      onUpdateUser?.(updated);
      onProfileUpdated?.(updated);
      try { localStorage.setItem('s_os_user', JSON.stringify(updated)); } catch (_) {}
    }
    setPushLoading(false);
  };
  
  // UI states
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    setPhotoURL(currentUser.photoURL || currentUser.avatar || '');
    setBannerUrl(currentUser.bannerUrl || '');
    setBannerPreset(currentUser.bannerPreset || BANNER_PRESETS[0].gradient);
    setBio(currentUser.bio || '');
    setPronouns(currentUser.pronouns || '');
    setCustomStatus(currentUser.customStatus || '');
    setAvatarFrame((currentUser.avatarFrame as ProfileFrameStyle) || 'none');
    setAccentColor(currentUser.accentColor || 'indigo');
  }, [currentUser]);

  // Character limit for bio
  const BIO_LIMIT = 300;

  // Sanitize helper
  const sanitizeText = (text: string) => {
    return text.replace(/[<>]/g, '').trim();
  };

  // Avatar upload handler
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Avatar file size must be less than 5MB.');
      return;
    }

    setUploadingAvatar(true);
    setErrorMsg(null);
    try {
      const path = `avatars/${currentUser.uid || 'user'}_${Date.now()}.${file.name.split('.').pop()}`;
      const uploadRes = await uploadFileToStorage(file, path);
      const url = typeof uploadRes === 'object' && uploadRes !== null && 'url' in uploadRes ? (uploadRes as any).url : String(uploadRes || '');
      setPhotoURL(url);
    } catch (err: any) {
      console.warn('Avatar upload fallback to data URL:', err);
      const reader = new FileReader();
      reader.onload = () => setPhotoURL(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Banner upload handler
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Banner file size must be less than 8MB.');
      return;
    }

    setUploadingBanner(true);
    setErrorMsg(null);
    try {
      const path = `banners/${currentUser.uid || 'user'}_${Date.now()}.${file.name.split('.').pop()}`;
      const uploadRes = await uploadFileToStorage(file, path);
      const url = typeof uploadRes === 'object' && uploadRes !== null && 'url' in uploadRes ? (uploadRes as any).url : String(uploadRes || '');
      setBannerUrl(url);
    } catch (err: any) {
      console.warn('Banner upload fallback to data URL:', err);
      const reader = new FileReader();
      reader.onload = () => setBannerUrl(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setUploadingBanner(false);
    }
  };

  // Save profile customization
  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    const sanitizedBio = sanitizeText(bio);
    const sanitizedPronouns = sanitizeText(pronouns);
    const sanitizedStatus = sanitizeText(customStatus);

    // Safeguard: only cosmetic customization fields are updated
    const updatedProfile: UserProfile = {
      ...currentUser,
      photoURL: photoURL || currentUser.photoURL || currentUser.avatar,
      avatar: photoURL || currentUser.avatar || currentUser.photoURL,
      bannerUrl: bannerUrl || undefined,
      bannerPreset: bannerPreset || undefined,
      bio: sanitizedBio,
      pronouns: sanitizedPronouns,
      customStatus: sanitizedStatus,
      avatarFrame: avatarFrame,
      accentColor: accentColor
    };

    let persistedProfile: UserProfile = updatedProfile;
    let savedSuccessfully = false;

    try {
      // 1. Primary save via Supabase user profile service
      persistedProfile = await saveSupabaseUserProfile(updatedProfile);
      savedSuccessfully = true;
    } catch (saveErr: any) {
      console.warn('saveSupabaseUserProfile warning, trying direct table update:', saveErr);
      
      // 2. Direct table fallback if service throws
      try {
        const targetId = currentUser.uid || currentUser.email;
        if (targetId) {
          const { data, error } = await supabase
            .from('user_profiles')
            .upsert({
              id: targetId,
              uid: currentUser.uid || targetId,
              email: currentUser.email?.toLowerCase(),
              name: currentUser.name,
              role: currentUser.role || 'student',
              photo_url: updatedProfile.photoURL,
              bio: updatedProfile.bio,
              raw_data: {
                ...(currentUser.raw_data || {}),
                bannerUrl: updatedProfile.bannerUrl,
                bannerPreset: updatedProfile.bannerPreset,
                bio: updatedProfile.bio,
                pronouns: updatedProfile.pronouns,
                customStatus: updatedProfile.customStatus,
                avatarFrame: updatedProfile.avatarFrame,
                accentColor: updatedProfile.accentColor
              },
              updated_at: Date.now()
            }, { onConflict: 'id' })
            .select()
            .maybeSingle();

          if (error) throw error;
          savedSuccessfully = true;
          if (data) {
            persistedProfile = { ...updatedProfile, ...data };
          }
        }
      } catch (directErr: any) {
        console.error('Direct fallback save also failed:', directErr);
        setErrorMsg(`Failed to save profile to database: ${directErr.message || 'Network error'}`);
        setSaving(false);
        return;
      }
    }

    if (savedSuccessfully) {
      // 3. Update local storage cache and recent accounts
      try {
        localStorage.setItem('s_os_user', JSON.stringify(persistedProfile));
        const recentRaw = localStorage.getItem('s_os_recent_accounts');
        if (recentRaw) {
          const recents = JSON.parse(recentRaw);
          if (Array.isArray(recents)) {
            const idx = recents.findIndex((a: any) => a.uid === persistedProfile.uid || a.email === persistedProfile.email);
            if (idx >= 0) {
              recents[idx] = { ...recents[idx], ...persistedProfile };
            } else {
              recents.unshift(persistedProfile);
            }
            localStorage.setItem('s_os_recent_accounts', JSON.stringify(recents));
          }
        }
      } catch (_) {}

      onUpdateUser?.(persistedProfile);
      onProfileUpdated?.(persistedProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }

    setSaving(false);
  };

  // Frame styling lookup
  const selectedFrameObj = AVATAR_FRAMES.find(f => f.id === avatarFrame) || AVATAR_FRAMES[0];
  const selectedAccent = ACCENT_COLORS.find(a => a.id === accentColor) || ACCENT_COLORS[0];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="p-6 bg-slate-900 border border-white/10 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-white">Discord-Style Profile Studio</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Customizer
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Personalize your banners, avatar borders, status, and theme to stand out across StudentOS.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 shrink-0" />
          <span>Profile customization saved successfully! Your updated card is now live across the platform.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Customization Controls (Left) & Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* SECTION 1: Banner Customization */}
          <div className="p-5 bg-slate-950/60 border border-white/10 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Image className="w-4 h-4 text-indigo-400" />
                Profile Banner
              </label>
              {bannerUrl && (
                <button
                  onClick={() => setBannerUrl('')}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  Clear Custom Image
                </button>
              )}
            </div>

            {/* Upload Custom Banner */}
            <div className="flex items-center gap-3">
              <label className="flex-1 py-3 px-4 rounded-xl bg-slate-900 border border-dashed border-white/20 hover:border-indigo-400 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-slate-900/80">
                <Camera className="w-4 h-4 text-slate-400" />
                <span>{uploadingBanner ? 'Uploading...' : 'Upload Banner Image (Max 8MB)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  disabled={uploadingBanner}
                  className="hidden"
                />
              </label>
            </div>

            {/* Curated Discord-style Presets */}
            <div>
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block mb-2">
                Or Select Discord Gradient Theme:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BANNER_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setBannerPreset(preset.gradient);
                      setBannerUrl('');
                    }}
                    className={`h-14 rounded-xl ${preset.gradient} p-2 flex flex-col justify-end text-left border transition-all relative overflow-hidden group ${bannerPreset === preset.gradient && !bannerUrl ? 'ring-2 ring-white border-white scale-[1.02]' : 'border-white/10 opacity-75 hover:opacity-100'}`}
                  >
                    <span className="text-[9px] font-black text-white drop-shadow truncate">{preset.name}</span>
                    {bannerPreset === preset.gradient && !bannerUrl && (
                      <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center text-slate-900 text-[8px] font-black">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 2: Avatar & Frame Styles */}
          <div className="p-5 bg-slate-950/60 border border-white/10 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Avatar Frame & Border
              </label>
              <label className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer">
                <Camera className="w-3.5 h-3.5" />
                <span>{uploadingAvatar ? 'Uploading...' : 'Change Avatar'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {AVATAR_FRAMES.map(frame => (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => setAvatarFrame(frame.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${avatarFrame === frame.id ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-900/50 border-white/5 hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{frame.name}</span>
                    <span className={`w-3.5 h-3.5 rounded-full border-2 ${frame.previewBorder} ${avatarFrame === frame.id ? 'bg-indigo-500' : 'bg-transparent'}`} />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">{frame.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 3: Bio, Pronouns & Custom Status */}
          <div className="p-5 bg-slate-950/60 border border-white/10 rounded-2xl space-y-4">
            <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              Bio & About Me
            </label>

            {/* Pronouns & Status in a row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pronouns</label>
                <input
                  type="text"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  placeholder="e.g. he/him, they/them"
                  maxLength={40}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Custom Status</label>
                <input
                  type="text"
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  placeholder="e.g. In Chemistry Lab 🔬"
                  maxLength={60}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Multiline Bio */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">About Me (Bio)</label>
                <span className={`text-[10px] font-mono font-bold ${bio.length > BIO_LIMIT * 0.9 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {bio.length} / {BIO_LIMIT}
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your academic interests, club roles, favorite subjects, or study goals..."
                maxLength={BIO_LIMIT}
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
              />
            </div>

            {/* SECTION 4: Theme Accent Color */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Profile Accent Theme</label>
              <div className="flex flex-wrap items-center gap-2.5">
                {ACCENT_COLORS.map(color => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setAccentColor(color.id)}
                    className={`h-8 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold border transition-all ${accentColor === color.id ? 'border-white text-white scale-105 shadow-md' : 'border-white/10 text-slate-400 hover:text-white'}`}
                  >
                    <span className={`w-3 h-3 rounded-full ${color.bg}`} />
                    <span>{color.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Discord-Style Profile Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              Live Profile Card Preview
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">Realtime Sync</span>
          </div>

          {/* Discord-style Card Container */}
          <div className="w-full rounded-3xl bg-slate-950 border border-white/10 shadow-2xl overflow-hidden relative">
            {/* Banner Section */}
            <div className="relative h-28 w-full overflow-hidden">
              {bannerUrl ? (
                <img
                  src={bannerUrl}
                  alt="Profile Banner"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={`w-full h-full ${bannerPreset}`} />
              )}
              {/* Optional House/Role Tag on Banner */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {currentUser.house && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-black/60 text-white backdrop-blur-md border border-white/10 shadow">
                    {currentUser.house}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-600/80 text-white backdrop-blur-md border border-indigo-400/30 uppercase tracking-wider">
                  {currentUser.role}
                </span>
              </div>
            </div>

            {/* Avatar & Floating Frame */}
            <div className="px-6 relative -mt-10 flex items-end justify-between">
              <div className="relative">
                {/* Avatar with Frame */}
                <div className={selectedFrameObj.className}>
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={currentUser.name}
                      className="w-20 h-20 rounded-full object-cover bg-slate-900"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-inner">
                      {currentUser.name ? currentUser.name[0] : 'S'}
                    </div>
                  )}
                </div>

                {/* Online Indicator */}
                <span className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 rounded-full border-4 border-slate-950 shadow-md" />
              </div>

              {/* Badges Bar */}
              <div className="flex items-center gap-1 mb-2 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
                <span title="StudentOS Scholar" className="text-sm">🏆</span>
                {currentUser.role === 'teacher' && <span title="Verified Faculty" className="text-sm">🎓</span>}
                {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && <span title="System Administrator" className="text-sm">🛡️</span>}
                <span title="Early Adopter" className="text-sm">⚡</span>
              </div>
            </div>

            {/* Profile Info Section */}
            <div className="p-6 pt-3 space-y-4">
              {/* Name & Pronouns */}
              <div>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-lg font-black text-white tracking-tight">{currentUser.name || 'Anonymous User'}</h4>
                  {pronouns && (
                    <span className="text-xs text-slate-400 font-medium">({pronouns})</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {currentUser.email} &bull; {currentUser.grade || 'Academic Member'} {currentUser.section ? `(${currentUser.section})` : ''}
                </p>
              </div>

              {/* Custom Status Box */}
              {customStatus && (
                <div className="p-2.5 rounded-xl bg-slate-900/70 border border-white/5 flex items-center gap-2 text-xs text-slate-200">
                  <Smile className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="italic truncate">{customStatus}</span>
                </div>
              )}

              {/* Bio / About */}
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">About Me</span>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {bio || 'No bio written yet. Click on the bio field to express yourself!'}
                </p>
              </div>

              {/* Member Since / Academic Details */}
              <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-slate-900/50 rounded-xl border border-white/5">
                  <span className="text-slate-500 font-bold uppercase text-[9px] block">Streak</span>
                  <span className="text-amber-400 font-bold font-mono">🔥 {currentUser.streakDays || 1} Days</span>
                </div>
                <div className="p-2.5 bg-slate-900/50 rounded-xl border border-white/5">
                  <span className="text-slate-500 font-bold uppercase text-[9px] block">House</span>
                  <span className="text-white font-bold">{currentUser.house || 'Unassigned'}</span>
                </div>
              </div>

              {/* Action Preview Button */}
              <button
                type="button"
                disabled
                className={`w-full py-2.5 rounded-xl text-xs font-bold text-white uppercase tracking-wider opacity-80 cursor-default ${selectedAccent.bg}`}
              >
                Send Direct Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileCustomizer;
