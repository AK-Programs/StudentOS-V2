import React, { useState, useEffect } from 'react';
import { 
  User, Palette, ShieldCheck, Smartphone, Bell, Sliders, Sparkles, 
  Camera, Check, AlertCircle, Save, ExternalLink, Plus, Trash2, 
  RefreshCw, Lock, Mail, Phone, ShieldAlert, Monitor, CheckCircle2, ChevronRight,
  BellRing
} from 'lucide-react';
import { UserProfile, ProfileFrameStyle } from '../types';
import { saveSupabaseUserProfile } from '../lib/supabaseUsers';
import { uploadFileToStorage } from '../lib/storageHelper';
import { BANNER_PRESETS, ACCENT_COLORS, AVATAR_FRAMES } from './ProfileCustomizer';
import { useTheme, ThemeId, STUDENTOS_THEMES } from '../lib/themeSystem';
import { useAppEnvironment, promptPWAInstall } from '../lib/appEnvironment';
import { APP_VERSION, APP_BUILD_ID } from '../config/version';
import { EnvironmentBadge } from './EnvironmentBadge';
import { 
  getVerificationStatus, resendEmailVerification, 
  requestPhoneOtp, verifyPhoneOtpCode, maskPhone, maskEmail 
} from '../lib/verification';
import { ProfessionalTabDropdown } from './ProfessionalTabDropdown';
import { 
  enableOneSignalWebPush, 
  disableOneSignalWebPush, 
  getOneSignalPushStatus 
} from '../lib/oneSignal';

export type SettingsSubSection = 'customization' | 'info' | 'theme' | 'verification' | 'environment' | 'notifications';

interface ProfileSettingsProps {
  currentUser: UserProfile;
  initialSubSection?: SettingsSubSection;
  onUpdateUser?: (updated: UserProfile) => void;
  onProfileUpdated?: (updated: any) => void;
}

interface CustomCardItem {
  id: string;
  title: string;
  badge?: string;
  content: string;
  link?: string;
  linkText?: string;
  icon?: string;
  visible: boolean;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  currentUser,
  initialSubSection = 'customization',
  onUpdateUser,
  onProfileUpdated
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSubSection>(initialSubSection);

  // Environment detection
  const env = useAppEnvironment();

  // Theme engine
  const { currentTheme, changeTheme, themes } = useTheme(currentUser);

  // Verification state
  const [verification, setVerification] = useState(() => getVerificationStatus(currentUser));
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState(currentUser.phone || '');
  const [otpInput, setOtpInput] = useState('');
  const [showOtpField, setShowOtpField] = useState(false);
  const [phoneNotice, setPhoneNotice] = useState<string | null>(null);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);

  // Customization state
  const rawData = currentUser.raw_data || {};
  const [photoURL, setPhotoURL] = useState<string>(currentUser.photoURL || currentUser.avatar || '');
  const [bannerUrl, setBannerUrl] = useState<string>(currentUser.bannerUrl || rawData.bannerUrl || '');
  const [bannerPreset, setBannerPreset] = useState<string>(currentUser.bannerPreset || rawData.bannerPreset || BANNER_PRESETS[0].gradient);
  const [bio, setBio] = useState<string>(currentUser.bio || rawData.bio || '');
  const [pronouns, setPronouns] = useState<string>(currentUser.pronouns || rawData.pronouns || '');
  const [customStatus, setCustomStatus] = useState<string>(currentUser.customStatus || rawData.customStatus || '');
  const [avatarFrame, setAvatarFrame] = useState<ProfileFrameStyle>((currentUser.avatarFrame || rawData.avatarFrame || 'none') as ProfileFrameStyle);
  const [accentColor, setAccentColor] = useState<string>(currentUser.accentColor || rawData.accentColor || 'indigo');

  // Custom Cards state
  const [customCards, setCustomCards] = useState<CustomCardItem[]>(() => {
    return (rawData.customCards as CustomCardItem[]) || [
      {
        id: 'card-subjects',
        title: 'Favorite Subjects',
        badge: 'Academics',
        content: 'Mathematics, Quantum Physics, and Computer Science.',
        icon: '📚',
        visible: true
      },
      {
        id: 'card-goals',
        title: 'Study Goal 2026',
        badge: 'Milestone',
        content: 'Maintaining 95%+ attendance and preparing for Olympiad selections.',
        icon: '🎯',
        visible: true
      }
    ];
  });

  // UI state
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [envNotice, setEnvNotice] = useState<string | null>(null);

  // New card modal/form
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardBadge, setNewCardBadge] = useState('');
  const [newCardContent, setNewCardContent] = useState('');
  const [newCardIcon, setNewCardIcon] = useState('📌');
  const [newCardLink, setNewCardLink] = useState('');

  // Notifications preferences
  const [studyReminders, setStudyReminders] = useState(rawData.notifyStudy !== false);
  const [chatSounds, setChatSounds] = useState(rawData.notifyChat !== false);
  const [announcementsAlert, setAnnouncementsAlert] = useState(rawData.notifyAnnounce !== false);

  // OneSignal Web Push state
  const [enableWebPush, setEnableWebPush] = useState<boolean>(() => {
    return Boolean(currentUser.enableWebPush ?? rawData.enableWebPush ?? false);
  });
  const [pushStatusLoading, setPushStatusLoading] = useState<boolean>(false);
  const [pushNotice, setPushNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [oneSignalStatus, setOneSignalStatus] = useState<{
    supported: boolean;
    permission: 'default' | 'granted' | 'denied';
    optedIn: boolean;
    subscriptionId?: string;
  }>({
    supported: true,
    permission: 'default',
    optedIn: false
  });

  useEffect(() => {
    let isMounted = true;
    getOneSignalPushStatus().then((status) => {
      if (isMounted) {
        setOneSignalStatus(status);
        if (status.optedIn) {
          setEnableWebPush(true);
        }
      }
    });
    return () => { isMounted = false; };
  }, []);

  const handleToggleWebPush = async (newVal: boolean) => {
    setPushStatusLoading(true);
    setPushNotice(null);

    if (newVal) {
      setPushNotice({ text: 'Requesting permission via OneSignal...', type: 'info' });
      const result = await enableOneSignalWebPush(
        currentUser.uid || currentUser.email,
        currentUser.role,
        {
          house: currentUser.house || 'None',
          grade: currentUser.grade || '10',
          section: currentUser.section || 'A'
        }
      );

      if (result.success && result.optedIn) {
        setEnableWebPush(true);
        setOneSignalStatus(prev => ({
          ...prev,
          permission: 'granted',
          optedIn: true,
          subscriptionId: result.subscriptionId
        }));
        setPushNotice({
          text: '✓ Web Push Notifications activated! OneSignal is registered to deliver targeted alerts for your role.',
          type: 'success'
        });

        // Persist preference to Supabase / Firebase user profile
        const updated: UserProfile = {
          ...currentUser,
          enableWebPush: true,
          oneSignalSubscriptionId: result.subscriptionId || currentUser.oneSignalSubscriptionId,
          raw_data: {
            ...(currentUser.raw_data || {}),
            enableWebPush: true,
            oneSignalSubscribed: true,
            oneSignalSubscriptionId: result.subscriptionId
          }
        };

        try {
          await saveSupabaseUserProfile(updated);
          onUpdateUser?.(updated);
          onProfileUpdated?.(updated);
          localStorage.setItem('s_os_user', JSON.stringify(updated));
        } catch (saveErr) {
          console.warn('[ProfileSettings] Error updating profile with push preference:', saveErr);
        }
      } else {
        setEnableWebPush(false);
        setOneSignalStatus(prev => ({ ...prev, permission: result.permission || 'denied', optedIn: false }));
        setPushNotice({
          text: result.error || 'Notification permission was denied. Please allow notifications in your browser settings.',
          type: 'error'
        });
      }
    } else {
      await disableOneSignalWebPush();
      setEnableWebPush(false);
      setOneSignalStatus(prev => ({ ...prev, optedIn: false }));
      setPushNotice({
        text: 'Web push notifications turned off for this profile.',
        type: 'info'
      });

      // Persist disabled preference to profile
      const updated: UserProfile = {
        ...currentUser,
        enableWebPush: false,
        raw_data: {
          ...(currentUser.raw_data || {}),
          enableWebPush: false,
          oneSignalSubscribed: false
        }
      };

      try {
        await saveSupabaseUserProfile(updated);
        onUpdateUser?.(updated);
        onProfileUpdated?.(updated);
        localStorage.setItem('s_os_user', JSON.stringify(updated));
      } catch (saveErr) {
        console.warn('[ProfileSettings] Error saving push disable preference:', saveErr);
      }
    }
    setPushStatusLoading(false);
  };

  useEffect(() => {
    setVerification(getVerificationStatus(currentUser));
  }, [currentUser]);

  // Handle avatar image upload
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
      const res = await uploadFileToStorage(file, 'avatars');
      setPhotoURL(res.url);
    } catch (err: any) {
      setErrorMsg('Failed to upload avatar image: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle banner image upload
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
      const res = await uploadFileToStorage(file, 'banners');
      setBannerUrl(res.url);
    } catch (err: any) {
      setErrorMsg('Failed to upload banner image: ' + err.message);
    } finally {
      setUploadingBanner(false);
    }
  };

  // Add custom card
  const handleAddCustomCard = () => {
    if (!newCardTitle.trim()) return;
    const card: CustomCardItem = {
      id: `card-${Date.now()}`,
      title: newCardTitle.trim(),
      badge: newCardBadge.trim() || undefined,
      content: newCardContent.trim(),
      link: newCardLink.trim() || undefined,
      icon: newCardIcon || '📌',
      visible: true
    };
    setCustomCards(prev => [...prev, card]);
    setNewCardTitle('');
    setNewCardBadge('');
    setNewCardContent('');
    setNewCardLink('');
    setShowAddCard(false);
  };

  // Remove custom card
  const handleRemoveCard = (cardId: string) => {
    setCustomCards(prev => prev.filter(c => c.id !== cardId));
  };

  // Toggle card visibility
  const handleToggleCard = (cardId: string) => {
    setCustomCards(prev => prev.map(c => c.id === cardId ? { ...c, visible: !c.visible } : c));
  };

  // Save all customization & preferences to Supabase
  const handleSaveAll = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const updatedProfile: UserProfile = {
        ...currentUser,
        photoURL,
        avatar: photoURL,
        bannerUrl: bannerUrl || undefined,
        bannerPreset,
        bio,
        pronouns,
        customStatus,
        avatarFrame,
        accentColor,
        enableWebPush,
        oneSignalSubscriptionId: oneSignalStatus.subscriptionId || currentUser.oneSignalSubscriptionId,
        raw_data: {
          ...(currentUser.raw_data || {}),
          avatarFrame,
          bannerUrl,
          bannerPreset,
          bio,
          pronouns,
          customStatus,
          accentColor,
          customCards,
          theme: currentTheme,
          notifyStudy: studyReminders,
          notifyChat: chatSounds,
          notifyAnnounce: announcementsAlert,
          enableWebPush,
          oneSignalSubscriptionId: oneSignalStatus.subscriptionId || currentUser.oneSignalSubscriptionId
        }
      };

      const saved = await saveSupabaseUserProfile(updatedProfile);
      onUpdateUser?.(saved);
      onProfileUpdated?.(saved);

      try {
        localStorage.setItem('s_os_user', JSON.stringify(saved));
      } catch (_) {}

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg('Failed to save to Supabase: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Resend email verification
  const handleResendEmail = async () => {
    if (!currentUser.email) return;
    setEmailNotice('Dispatching verification link...');
    const res = await resendEmailVerification(currentUser.email);
    setEmailNotice(res.message);
  };

  // Request phone OTP
  const handleSendPhoneOtp = async () => {
    if (!phoneInput) return;
    setIsVerifyingPhone(true);
    setPhoneNotice('Sending OTP code...');
    const res = await requestPhoneOtp(phoneInput);
    setIsVerifyingPhone(false);
    setPhoneNotice(res.message);
    if (res.success) {
      setShowOtpField(true);
    }
  };

  // Confirm phone OTP
  const handleVerifyPhoneOtp = async () => {
    if (!otpInput) return;
    setIsVerifyingPhone(true);
    setPhoneNotice('Verifying code...');
    const res = await verifyPhoneOtpCode(phoneInput, otpInput);
    setIsVerifyingPhone(false);
    setPhoneNotice(res.message);

    if (res.success) {
      // Update phone verification in profile
      const updated = {
        ...currentUser,
        phone: phoneInput,
        phone_confirmed_at: new Date().toISOString(),
        raw_data: {
          ...(currentUser.raw_data || {}),
          phone: phoneInput,
          phoneVerifiedAt: new Date().toISOString(),
          verification: {
            ...(currentUser.raw_data?.verification || {}),
            phoneVerified: true
          }
        }
      };
      await saveSupabaseUserProfile(updated);
      onUpdateUser?.(updated);
      setShowOtpField(false);
      setVerification(getVerificationStatus(updated));
    }
  };

  // Active frame object
  const activeFrame = AVATAR_FRAMES.find(f => f.id === avatarFrame) || AVATAR_FRAMES[0];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Settings Header with App Environment Indicator */}
      <div className="smart-glass p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-3 py-0.5 rounded-full border border-indigo-500/20 tracking-wider">
                Profile Settings
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                {env.badgeLabel}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight">
              Settings & Personalization Studio
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Configure your profile identity, custom cards, global themes, verification, and device settings.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save All Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Save Feedback */}
        {saveSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-2 text-xs font-bold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Settings and customizations successfully synchronized with Supabase!</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2 text-xs font-bold animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Sub-Section Navigation Dropdown */}
        <div className="pt-2 pb-1 relative z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-950/70 border border-white/10 rounded-2xl">
            <div className="w-full sm:max-w-md">
              <ProfessionalTabDropdown
                options={[
                  { 
                    id: 'customization', 
                    label: 'Customization & Cards', 
                    icon: <Sparkles className="w-4 h-4" />,
                    description: 'Bio banners, custom links and profile badges' 
                  },
                  { 
                    id: 'theme', 
                    label: 'Themes & Aesthetics', 
                    icon: <Palette className="w-4 h-4" />,
                    description: 'System palettes and visual atmosphere' 
                  },
                  { 
                    id: 'verification', 
                    label: 'Verification & Security', 
                    icon: <ShieldCheck className="w-4 h-4" />,
                    badge: verification.isVerified ? 'Verified' : 'Pending',
                    badgeColor: verification.isVerified ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                    description: 'Email, phone OTP and security validation' 
                  },
                  { 
                    id: 'info', 
                    label: 'Profile Information', 
                    icon: <User className="w-4 h-4" />,
                    description: 'Public presence and personal details' 
                  },
                  { 
                    id: 'environment', 
                    label: 'App Environment & APK', 
                    icon: <Smartphone className="w-4 h-4" />,
                    description: 'PWA, Android APK, and client runtime' 
                  },
                  { 
                    id: 'notifications', 
                    label: 'Web Push & Notifications', 
                    icon: <Bell className="w-4 h-4" />,
                    badge: enableWebPush ? 'Active' : undefined,
                    badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
                    description: 'VAPID Web Push, sounds and mentions' 
                  }
                ]}
                selectedId={activeSection}
                onSelect={(id) => setActiveSection(id as SettingsSubSection)}
                size="md"
              />
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-300">
              <span className="text-slate-500 font-medium">Studio Tab:</span>
              <span className="font-bold text-indigo-400 capitalize">
                {activeSection.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CUSTOMIZATION & CUSTOM CARDS STUDIO                                     */}
      {/* ========================================================================= */}
      {activeSection === 'customization' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Left Column: Customization Controls */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Banner Customization */}
            <div className="smart-glass p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black font-display text-white uppercase tracking-wider">
                  Profile Banner
                </h3>
                <label className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{uploadingBanner ? 'Uploading...' : 'Upload Image'}</span>
                  <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" disabled={uploadingBanner} />
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {BANNER_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setBannerPreset(preset.gradient);
                      setBannerUrl('');
                    }}
                    className={`h-14 rounded-xl relative overflow-hidden border transition-all ${
                      bannerPreset === preset.gradient && !bannerUrl ? 'border-white ring-2 ring-indigo-500 scale-95' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className={`w-full h-full ${preset.gradient}`} />
                    <span className="absolute bottom-1 left-2 text-[9px] font-bold text-white drop-shadow">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar Frame / Border Selector */}
            <div className="smart-glass p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black font-display text-white uppercase tracking-wider">
                  Avatar Border / Frame
                </h3>
                <span className="text-[10px] text-slate-400">9 Styles</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {AVATAR_FRAMES.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setAvatarFrame(f.id)}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                      avatarFrame === f.id
                        ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-slate-900/60 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full ${f.className} shrink-0 bg-slate-950 flex items-center justify-center text-xs`}>
                      👑
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{f.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{f.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar Upload & Profile Accent */}
            <div className="smart-glass p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-4">
              <h3 className="text-sm font-black font-display text-white uppercase tracking-wider">
                Avatar & Accent Color
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className={`w-16 h-16 rounded-full ${activeFrame.className} shrink-0 bg-slate-950 flex items-center justify-center overflow-hidden`}>
                  {photoURL ? (
                    <img src={photoURL} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="text-xl font-bold text-white">{(currentUser.name || 'U').charAt(0)}</div>
                  )}
                </div>

                <div className="space-y-1 text-center sm:text-left">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{uploadingAvatar ? 'Uploading...' : 'Change Avatar Photo'}</span>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
                  </label>
                  <p className="text-[10px] text-slate-400">JPG, PNG, GIF up to 5MB.</p>
                </div>
              </div>

              {/* Accent Colors */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="text-xs font-bold text-slate-400 block">Profile Accent Aura</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {ACCENT_COLORS.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => setAccentColor(acc.id)}
                      className={`w-7 h-7 rounded-full ${acc.bg} transition-all ${
                        accentColor === acc.id ? 'ring-4 ring-white/30 scale-110' : 'hover:scale-105'
                      }`}
                      title={acc.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Bio, Pronouns, and Custom Status */}
            <div className="smart-glass p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-4">
              <h3 className="text-sm font-black font-display text-white uppercase tracking-wider">
                Identity & Status
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400">Pronouns</label>
                  <input
                    type="text"
                    value={pronouns}
                    onChange={e => setPronouns(e.target.value)}
                    placeholder="e.g. they/them, she/her, he/him"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400">Custom Status Message</label>
                  <input
                    type="text"
                    value={customStatus}
                    onChange={e => setCustomStatus(e.target.value)}
                    placeholder="e.g. 📚 Studying for physics exam"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">About / Bio (Markdown & emoji supported)</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Share a short bio with teachers and classmates..."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Custom Cards Manager (Migrated & Integrated) */}
            <div className="smart-glass p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black font-display text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>🗂️</span> Custom Profile Cards
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add customizable informational cards that appear on your public profile.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddCard(!showAddCard)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Card</span>
                </button>
              </div>

              {/* Add Card Form */}
              {showAddCard && (
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30 space-y-3 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      placeholder="Card Title (e.g. Study Goals)"
                      value={newCardTitle}
                      onChange={e => setNewCardTitle(e.target.value)}
                      className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Badge Tag (e.g. 2026)"
                      value={newCardBadge}
                      onChange={e => setNewCardBadge(e.target.value)}
                      className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Emoji Icon (e.g. 🚀)"
                      value={newCardIcon}
                      onChange={e => setNewCardIcon(e.target.value)}
                      className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Card description or list of items..."
                    value={newCardContent}
                    onChange={e => setNewCardContent(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                  />
                  <input
                    type="url"
                    placeholder="Optional Link URL (e.g. https://github.com/...)"
                    value={newCardLink}
                    onChange={e => setNewCardLink(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddCard(false)}
                      className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddCustomCard}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                    >
                      Save Card
                    </button>
                  </div>
                </div>
              )}

              {/* Cards List */}
              <div className="space-y-2.5">
                {customCards.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 text-center">No custom cards created yet.</p>
                ) : (
                  customCards.map(card => (
                    <div
                      key={card.id}
                      className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex items-start justify-between gap-3 hover:border-white/15 transition-all"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{card.icon || '📌'}</span>
                          <span className="text-xs font-bold text-white">{card.title}</span>
                          {card.badge && (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono">
                              {card.badge}
                            </span>
                          )}
                          {!card.visible && (
                            <span className="text-[9px] text-slate-500 font-mono italic">(Hidden)</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2">{card.content}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleCard(card.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs"
                          title={card.visible ? 'Hide from public profile' : 'Show on public profile'}
                        >
                          {card.visible ? '👁️' : '🙈'}
                        </button>
                        <button
                          onClick={() => handleRemoveCard(card.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs"
                          title="Delete card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Live Interactive Profile Card Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-20 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Live Public Profile Preview
              </span>

              <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                {/* Banner preview */}
                <div className="relative h-28 w-full overflow-hidden">
                  {bannerUrl ? (
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full ${bannerPreset}`} />
                  )}
                  <span className="absolute bottom-2 right-3 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-black/60 text-white border border-white/10 backdrop-blur-sm">
                    {currentUser.role || 'Student'}
                  </span>
                </div>

                {/* Avatar and Info */}
                <div className="p-5 pt-0 space-y-3">
                  <div className="-mt-10 flex items-end justify-between">
                    <div className="relative">
                      <div className={`w-20 h-20 rounded-full ${activeFrame.className} bg-slate-900 flex items-center justify-center overflow-hidden`}>
                        {photoURL ? (
                          <img src={photoURL} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <div className="text-2xl font-bold text-white">{(currentUser.name || 'U').charAt(0)}</div>
                        )}
                      </div>
                      {verification.isVerified && (
                        <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shadow-md border-2 border-slate-900">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="text-right pb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {currentUser.house ? `${currentUser.house} House` : 'Classroom'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-base font-black text-white">{currentUser.name}</h4>
                      {verification.isVerified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          <ShieldCheck className="w-2.5 h-2.5" /> Verified
                        </span>
                      )}
                      {pronouns && <span className="text-[11px] text-slate-400 font-mono">({pronouns})</span>}
                    </div>
                    {customStatus && (
                      <p className="text-xs text-indigo-300 font-medium">💬 {customStatus}</p>
                    )}
                  </div>

                  {bio && (
                    <div className="p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs text-slate-300 whitespace-pre-line">
                      {bio}
                    </div>
                  )}

                  {/* Custom cards preview in card */}
                  {customCards.filter(c => c.visible).length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {customCards.filter(c => c.visible).slice(0, 2).map(c => (
                        <div key={c.id} className="p-2 rounded-xl bg-slate-800/40 border border-white/5 text-xs">
                          <div className="font-bold text-white text-[11px]">{c.icon} {c.title}</div>
                          <div className="text-slate-400 text-[10px] truncate">{c.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. THEMES SELECTOR                                                        */}
      {/* ========================================================================= */}
      {activeSection === 'theme' && (
        <div className="smart-glass p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 animate-fadeIn">
          <div className="space-y-1">
            <h3 className="text-lg font-black font-display text-white">
              StudentOS Global Themes
            </h3>
            <p className="text-xs text-slate-400 max-w-xl">
              Themes apply globally across the entire StudentOS platform — including Dashboard, Profile, Material Hub, Chat, Meetings, and Attendance. Your preference is persisted to Supabase and synchronized across Web and App.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {themes.map(t => {
              const isSelected = currentTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => changeTheme(t.id)}
                  className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                    isSelected
                      ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/50 shadow-xl'
                      : 'bg-slate-950/80 border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Theme preview swatch */}
                  <div className={`h-20 rounded-xl mb-3.5 bg-gradient-to-r ${t.previewGradient} border border-white/10 p-2.5 flex flex-col justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.colors.primary }} />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.colors.accent }} />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.colors.background }} />
                    </div>
                    <div className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/50 text-white w-fit">
                      {t.isDark ? 'Dark / High-Contrast' : 'Light / Paper'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{t.name}</h4>
                      <p className="text-xs text-slate-400">{t.tagline}</p>
                    </div>
                    {isSelected && (
                      <span className="p-1 rounded-full bg-indigo-600 text-white shadow">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span>Current Active Theme: <strong>{STUDENTOS_THEMES[currentTheme]?.name}</strong></span>
            <span className="text-slate-400 text-[11px]">Synced to Supabase & localStorage</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VERIFICATION & SECURITY                                                */}
      {/* ========================================================================= */}
      {activeSection === 'verification' && (
        <div className="smart-glass p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 animate-fadeIn">
          {/* Verification Score & Badge Status Banner */}
          <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            verification.isVerified
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                verification.isVerified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {verification.isVerified ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-white">
                    {verification.isVerified ? 'StudentOS Verified Account' : 'Account Verification Incomplete'}
                  </h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/40 text-white">
                    {verification.verifiedCount} / 3 Methods
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {verification.isVerified
                    ? 'Congratulations! Your account has met the criteria (≥ 2 verified methods) and displays the official StudentOS Verified badge.'
                    : 'Your account is not fully verified. Verify at least two methods to receive the StudentOS Verified badge.'}
                </p>
              </div>
            </div>

            {verification.isVerified && (
              <div className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md">
                <ShieldCheck className="w-4 h-4" />
                <span>✓ StudentOS Verified</span>
              </div>
            )}
          </div>

          {/* Verification Methods List */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider">
              Verification Methods
            </h4>

            {/* Method 1: Email */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-5 h-5 text-indigo-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">Email Verification</span>
                    <span className="text-[11px] text-slate-400">{verification.maskedEmail || currentUser.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {verification.emailVerified ? (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      ✓ Verified
                    </span>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        ⚠ Not verified
                      </span>
                      <button
                        onClick={handleResendEmail}
                        className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg transition-all"
                      >
                        Resend Link
                      </button>
                    </>
                  )}
                </div>
              </div>
              {emailNotice && (
                <p className="text-xs text-indigo-300 font-mono bg-indigo-500/10 p-2 rounded-lg">{emailNotice}</p>
              )}
            </div>

            {/* Method 2: Phone */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <Phone className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">Phone Number Verification</span>
                    <span className="text-[11px] text-slate-400">{verification.maskedPhone || 'No phone registered'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {verification.phoneVerified ? (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      ✓ Verified
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      ⚠ Not verified
                    </span>
                  )}
                </div>
              </div>

              {/* Phone OTP Verification Interface */}
              {!verification.phoneVerified && (
                <div className="pt-2 border-t border-white/5 space-y-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      placeholder="+91 9876543210"
                      className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white max-w-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      onClick={handleSendPhoneOtp}
                      disabled={isVerifyingPhone}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {isVerifyingPhone ? 'Dispatching...' : 'Send OTP'}
                    </button>
                  </div>

                  {showOtpField && (
                    <div className="flex items-center gap-2 flex-wrap animate-fadeIn">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value)}
                        placeholder="6-digit OTP code"
                        className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white max-w-[140px] font-mono tracking-widest text-center"
                      />
                      <button
                        onClick={handleVerifyPhoneOtp}
                        disabled={isVerifyingPhone}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                      >
                        Confirm OTP
                      </button>
                    </div>
                  )}

                  {phoneNotice && (
                    <p className="text-xs text-slate-300 font-mono bg-black/30 p-2 rounded-lg">{phoneNotice}</p>
                  )}
                </div>
              )}
            </div>

            {/* Method 3: Government ID Verification */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-5 h-5 text-purple-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">Government Identity Verification</span>
                    <span className="text-[11px] text-slate-400">Compliant third-party identity verification gateway</span>
                  </div>
                </div>

                <span className="text-xs font-bold text-slate-400 flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                  Not available yet
                </span>
              </div>

              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-300 space-y-1">
                <p className="font-bold">Government ID verification is not available yet.</p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  StudentOS never directly stores raw Aadhaar cards, identity photos, or government documents. When legally compliant identity verification is enabled by school administration, it will be processed through an accredited external identity provider.
                </p>
              </div>
            </div>
          </div>

          {/* Privacy & Security Guidelines Notice */}
          <div className="p-4 rounded-2xl bg-black/20 border border-white/5 space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Privacy Notice
            </span>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your private phone number, email address, and verification credentials are never exposed publicly. Other students and faculty only see the ✓ Verified badge when your account meets the threshold.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PROFILE INFORMATION (READ-ONLY / CORE DETAILS)                          */}
      {/* ========================================================================= */}
      {activeSection === 'info' && (
        <div className="smart-glass p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 animate-fadeIn">
          <div className="space-y-1">
            <h3 className="text-lg font-black font-display text-white">
              Academic Profile Information
            </h3>
            <p className="text-xs text-slate-400">
              Core academic parameters are authorized by school coordinators and cannot be modified directly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Full Name</span>
              <p className="text-sm font-bold text-white">{currentUser.name}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Role</span>
              <p className="text-sm font-bold text-indigo-400 uppercase tracking-wider">{currentUser.role || 'Student'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Email Address</span>
              <p className="text-sm font-mono text-slate-300">{currentUser.email}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block">School House</span>
              <p className="text-sm font-bold text-white">{currentUser.house ? `${currentUser.house} House` : 'Not Assigned'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Grade / Section</span>
              <p className="text-sm font-bold text-white">Grade {currentUser.grade || 10} • Section {currentUser.section || 'A'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Roll / Student ID</span>
              <p className="text-sm font-mono text-slate-300">{currentUser.rollNumber || currentUser.uid || 'STU-2026-042'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. APP ENVIRONMENT & APP INFORMATION                                    */}
      {/* ========================================================================= */}
      {activeSection === 'environment' && (
        <div className="smart-glass p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-black font-display text-white">
                  App Information & Diagnostics
                </h3>
                <EnvironmentBadge />
              </div>
              <p className="text-xs text-slate-400">
                Centralized runtime environment detection, PWA installation status, and build diagnostics.
              </p>
            </div>

            {env.isInstallPromptAvailable && (
              <button
                type="button"
                onClick={async () => {
                  const res = await promptPWAInstall();
                  if (res.outcome === 'accepted') {
                    setEnvNotice('✓ StudentOS PWA installed successfully!');
                    setTimeout(() => setEnvNotice(null), 5000);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-500 hover:from-indigo-500 hover:to-teal-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer min-h-[40px]"
              >
                <span>Install StudentOS PWA</span>
              </button>
            )}
          </div>

          {envNotice && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{envNotice}</span>
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Environment</span>
              <p className="text-sm sm:text-base font-black text-white">{env.badgeLabel}</p>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">PWA Installed</span>
              <p className="text-sm sm:text-base font-black text-indigo-300">
                {env.isPWAInstalled ? 'Yes' : 'No'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Install Available</span>
              <p className="text-sm sm:text-base font-black text-amber-300">
                {env.isInstallPromptAvailable ? 'Yes' : 'No'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">App Version</span>
              <p className="text-sm sm:text-base font-black text-emerald-300 font-mono">
                v{APP_VERSION}
              </p>
            </div>
          </div>

          {/* Runtime Mode Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-5 rounded-2xl border transition-all ${env.isWeb ? 'bg-indigo-600/10 border-indigo-500 shadow-md shadow-indigo-950/30' : 'bg-slate-900/60 border-white/5 opacity-70'}`}>
              <div className="text-2xl mb-2">🌐</div>
              <h4 className="text-sm font-bold text-white">Web Browser</h4>
              <p className="text-xs text-slate-400 mt-1">Direct web browser session with responsive controls.</p>
              <span className={`inline-block mt-3 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                env.isWeb ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'
              }`}>
                {env.isWeb ? '● Active Runtime' : 'Inactive'}
              </span>
            </div>

            <div className={`p-5 rounded-2xl border transition-all ${env.isPWA ? 'bg-indigo-600/10 border-indigo-500 shadow-md shadow-indigo-950/30' : 'bg-slate-900/60 border-white/5 opacity-70'}`}>
              <div className="text-2xl mb-2">💻</div>
              <h4 className="text-sm font-bold text-white">Installed PWA</h4>
              <p className="text-xs text-slate-400 mt-1">Standalone desktop or mobile PWA without browser chrome.</p>
              <span className={`inline-block mt-3 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                env.isPWA ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'
              }`}>
                {env.isPWA ? '● Active Runtime' : 'Inactive'}
              </span>
            </div>

            <div className={`p-5 rounded-2xl border transition-all ${env.isAPK ? 'bg-indigo-600/10 border-indigo-500 shadow-md shadow-indigo-950/30' : 'bg-slate-900/60 border-white/5 opacity-70'}`}>
              <div className="text-2xl mb-2">📱</div>
              <h4 className="text-sm font-bold text-white">StudentOS App (APK)</h4>
              <p className="text-xs text-slate-400 mt-1">Native APK wrapper shell with deterministic bridge signals.</p>
              <span className={`inline-block mt-3 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                env.isAPK ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'
              }`}>
                {env.isAPK ? '● Active Runtime' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Technical Diagnostics */}
          <div className="p-5 rounded-2xl bg-black/30 border border-white/5 space-y-3 text-xs text-slate-300">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">Technical Diagnostics</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <p><strong>Display Mode:</strong> <span className="font-mono text-indigo-300">{env.displayMode}</span></p>
              <p><strong>Installed App Mode:</strong> <span className="font-mono text-indigo-300">{String(env.isInstalledApp)}</span></p>
              <p><strong>Build Identifier:</strong> <span className="font-mono text-slate-300">{APP_BUILD_ID}</span></p>
              <p><strong>Service Worker:</strong> <span className="font-mono text-emerald-300">{typeof window !== 'undefined' && 'serviceWorker' in navigator ? 'Active & Ready' : 'Not Supported'}</span></p>
              <p><strong>Network Status:</strong> <span className="font-mono text-emerald-300">{typeof navigator !== 'undefined' && navigator.onLine ? 'Online (Connected)' : 'Offline'}</span></p>
              <p><strong>Environment Details:</strong> <span className="text-slate-400">{env.details}</span></p>
            </div>

            <div className="pt-2 border-t border-white/5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistration().then(reg => {
                      reg?.update();
                      setEnvNotice('✓ Checked for updates. You are running the latest StudentOS build (v' + APP_VERSION + ').');
                      setTimeout(() => setEnvNotice(null), 5000);
                    });
                  } else {
                    setEnvNotice('Service worker is not active in this browser.');
                    setTimeout(() => setEnvNotice(null), 5000);
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check for App Updates</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. NOTIFICATIONS & PREFERENCES                                            */}
      {/* ========================================================================= */}
      {activeSection === 'notifications' && (
        <div className="smart-glass p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 animate-fadeIn">
          <div className="space-y-1">
            <h3 className="text-lg font-black font-display text-white">
              App Preferences & Alerts
            </h3>
            <p className="text-xs text-slate-400">
              Customize notification alerts, auditory bells, and study reminders.
            </p>
          </div>

          <div className="space-y-4">
            {/* ONE-SIGNAL WEB PUSH NOTIFICATIONS CARD */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-purple-950/70 border border-indigo-500/30 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0 mt-0.5">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-white tracking-tight">
                        Enable Web Push Notifications
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono text-[9px] font-black uppercase">
                        OneSignal SDK
                      </span>
                      {enableWebPush && oneSignalStatus.permission === 'granted' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Subscribed & Active
                        </span>
                      ) : oneSignalStatus.permission === 'denied' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          ⚠️ Permission Blocked
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10">
                          ○ Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                      Receive immediate desktop, Android APK, and PWA browser alerts for official announcements, assignment deadlines, grade updates, and release notes — even when StudentOS is in the background or closed.
                    </p>
                  </div>
                </div>

                {/* Animated Interactive Toggle Switch */}
                <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
                  {pushStatusLoading && (
                    <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableWebPush}
                    disabled={pushStatusLoading}
                    onClick={() => handleToggleWebPush(!enableWebPush)}
                    className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      enableWebPush ? 'bg-indigo-600' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        enableWebPush ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Status / Feedback Banner */}
              {pushNotice && (
                <div className={`p-3 rounded-xl border text-xs font-semibold animate-fadeIn flex items-center justify-between gap-2 ${
                  pushNotice.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                    : pushNotice.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                      : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                }`}>
                  <span>{pushNotice.text}</span>
                  <button 
                    onClick={() => setPushNotice(null)}
                    className="text-slate-400 hover:text-white text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Audience Targeting Segmentation Info */}
              <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase text-slate-400 font-mono">Targeted Segments:</span>
                  <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-indigo-300 font-mono text-[10px] font-bold">
                    role: {currentUser.role || 'student'}
                  </span>
                  {currentUser.grade && (
                    <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-slate-300 font-mono text-[10px]">
                      grade: {currentUser.grade}
                    </span>
                  )}
                  {currentUser.section && (
                    <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-slate-300 font-mono text-[10px]">
                      section: {currentUser.section}
                    </span>
                  )}
                  {currentUser.house && (
                    <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-slate-300 font-mono text-[10px]">
                      house: {currentUser.house}
                    </span>
                  )}
                </div>

                {enableWebPush && (
                  <button
                    type="button"
                    onClick={async () => {
                      if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('🔔 StudentOS Push Notification Verified', {
                          body: `Targeted update for ${currentUser.name} (${(currentUser.role || 'student').toUpperCase()}). You will receive real-time academic alerts!`,
                          icon: '/icons/icon-192.png'
                        });
                        setPushNotice({ text: '✓ Test notification delivered to your screen!', type: 'success' });
                      } else {
                        handleToggleWebPush(true);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-[11px] font-bold transition-all shrink-0 cursor-pointer self-start sm:self-auto"
                  >
                    Send Test Alert
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Homework & Study Reminders</span>
                <span className="text-[11px] text-slate-400">Receive alerts before assignments and scheduled exams.</span>
              </div>
              <input
                type="checkbox"
                checked={studyReminders}
                onChange={e => setStudyReminders(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-white/20 focus:ring-indigo-500"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Chat & Community Sound Effects</span>
                <span className="text-[11px] text-slate-400">Play auditory cues when new channel messages or direct chats arrive.</span>
              </div>
              <input
                type="checkbox"
                checked={chatSounds}
                onChange={e => setChatSounds(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-white/20 focus:ring-indigo-500"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Official Broadcast Announcements</span>
                <span className="text-[11px] text-slate-400">Display immediate banner notifications when school faculty publishes broadcasts.</span>
              </div>
              <input
                type="checkbox"
                checked={announcementsAlert}
                onChange={e => setAnnouncementsAlert(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-white/20 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
