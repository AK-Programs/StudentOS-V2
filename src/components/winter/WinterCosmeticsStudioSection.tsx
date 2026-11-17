/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reusable Winter Collectibles Customisation Section for ProfileSettings & ProfileCustomizer.
 * Strictly organizes Winter Profile Banners (background artwork), Winter Profile Borders
 * (perimeter avatar decorations), and Winter Badges with:
 * - Isolated Frost XP balance display
 * - Non-mutating Live Preview toggle
 * - Frost XP Purchase with confirmation dialog
 * - Equip / Unequip persistence
 * - Audited Super Admin Free Claim
 */

import React, { useState } from 'react';
import { Award, Eye, Lock, ShoppingBag, Sparkles } from 'lucide-react';
import { UserProfile } from '../../types';
import { isSuperAdminRole } from '../../lib/featureAccessService';
import {
  equipWinterBanner,
  equipWinterBorder,
  purchaseWinterCollectible,
  WinterProfileBanner,
  WinterProfileBorder,
  WinterStatusResponse,
} from '../../lib/winterFestivalService';
import { winterAudio } from '../../lib/winterAudio';
import { AnimatedDialog, TactileButton } from '../ui/animatedComponents';
import {
  ProfileBannerBackdrop,
  ProfileCosmeticAvatar,
} from './ProfileCosmeticRenderer';

interface WinterCosmeticsStudioSectionProps {
  currentUser: UserProfile;
  winterStatus: WinterStatusResponse | null;
  loading?: boolean;
  previewBannerId: string | null;
  previewBorderId: string | null;
  onPreviewBannerChange: (id: string | null) => void;
  onPreviewBorderChange: (id: string | null) => void;
  onRefreshWinterStatus: () => Promise<void>;
  /** Render only specific subsections when embedded inside separate customizer blocks */
  mode?: 'all' | 'banners' | 'borders' | 'badges';
  onStatusFeedback?: (msg: string, isError?: boolean) => void;
}

export const WinterCosmeticsStudioSection: React.FC<WinterCosmeticsStudioSectionProps> = ({
  currentUser,
  winterStatus,
  loading = false,
  previewBannerId,
  previewBorderId,
  onPreviewBannerChange,
  onPreviewBorderChange,
  onRefreshWinterStatus,
  mode = 'all',
  onStatusFeedback,
}) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [purchaseConfirm, setPurchaseConfirm] = useState<{
    itemType: 'banner' | 'border';
    item: WinterProfileBanner | WinterProfileBorder;
  } | null>(null);

  const isSuperAdmin = isSuperAdminRole(currentUser?.role);
  const ws = winterStatus?.winterState;
  const frostXp = ws?.frostXp || 0;
  const unlockedBanners = ws?.unlockedBanners || [];
  const unlockedBorders = ws?.unlockedBorders || [];
  const equippedBanner = ws?.equippedBanner || null;
  const equippedBorder = ws?.equippedBorder || null;
  const activeBorderForPreview = previewBorderId ?? equippedBorder;

  const notify = (msg: string, isError = false) => {
    onStatusFeedback?.(msg, isError);
  };

  const broadcastSync = () => {
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));
    window.dispatchEvent(new CustomEvent('veylentra-cosmetics-updated'));
  };

  const handleEquipBanner = async (bannerId: string | null) => {
    setBusyKey(`equip_banner:${bannerId || 'none'}`);
    const res = await equipWinterBanner(currentUser, bannerId);
    setBusyKey(null);
    if (!res.ok || !res.data?.success) {
      notify(res.data?.error || 'Could not update equipped banner.', true);
      return;
    }
    winterAudio.playBannerEquipped();
    onPreviewBannerChange(null);
    await onRefreshWinterStatus();
    broadcastSync();
    notify(bannerId ? 'Profile Banner equipped!' : 'Profile Banner unequipped.');
  };

  const handleEquipBorder = async (borderId: string | null) => {
    setBusyKey(`equip_border:${borderId || 'none'}`);
    const res = await equipWinterBorder(currentUser, borderId);
    setBusyKey(null);
    if (!res.ok || !res.data?.success) {
      notify(res.data?.error || 'Could not update equipped border.', true);
      return;
    }
    winterAudio.playBorderEquipped();
    onPreviewBorderChange(null);
    await onRefreshWinterStatus();
    broadcastSync();
    notify(borderId ? 'Profile Border equipped!' : 'Profile Border unequipped.');
  };

  const handleConfirmPurchase = async (adminGrant: boolean) => {
    if (!purchaseConfirm) return;
    const { itemType, item } = purchaseConfirm;
    setBusyKey(`buy:${itemType}:${item.id}`);
    const res = await purchaseWinterCollectible(currentUser, {
      itemType,
      itemId: item.id,
      adminGrant,
      idempotencyKey: `customizer_${itemType}_${item.id}_${Date.now()}`,
    });
    setBusyKey(null);
    if (!res.ok || !res.data?.success) {
      notify(res.data?.error || 'Could not unlock collectible.', true);
      return;
    }
    winterAudio.playPurchaseSuccess();
    setPurchaseConfirm(null);
    if (itemType === 'banner') {
      onPreviewBannerChange(null);
    } else {
      onPreviewBorderChange(null);
    }
    await onRefreshWinterStatus();
    broadcastSync();
    notify(`${item.name} unlocked and added to your collection!`);
  };

  if (loading && !winterStatus) {
    return (
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 text-xs text-slate-400">
        Loading Winter collectibles &amp; Frost XP balance...
      </div>
    );
  }

  if (!winterStatus) {
    return null;
  }

  const showBanners = mode === 'all' || mode === 'banners';
  const showBorders = mode === 'all' || mode === 'borders';
  const showBadges = mode === 'all' || mode === 'badges';

  return (
    <div className="space-y-5">
      {/* Frost XP Summary Pill Bar */}
      <div className="p-3 rounded-2xl bg-sky-950/40 border border-sky-400/25 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
          <span className="text-xs font-bold text-slate-100">
            Seasonal Frost XP Balance:
          </span>
          <span className="text-xs font-mono font-black text-cyan-300 tabular-nums">
            {frostXp} Frost XP
          </span>
        </div>
        {(previewBannerId || previewBorderId) && (
          <button
            type="button"
            onClick={() => {
              onPreviewBannerChange(null);
              onPreviewBorderChange(null);
            }}
            className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
          >
            Clear Non-Mutating Preview
          </button>
        )}
      </div>

      {/* SECTION: WINTER PROFILE BANNERS (BACKGROUND ARTWORK) */}
      {showBanners && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-sky-300">
                Winter Collectible Profile Banners (Background Artwork)
              </h4>
              <p className="text-[11px] text-slate-400">
                Displays behind your profile avatar and card header. Distinct from perimeter avatar borders.
              </p>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-sky-300 font-bold">
              {unlockedBanners.length} / {(winterStatus.banners || []).length} Owned
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(winterStatus.banners || []).map((banner) => {
              const isUnlocked = unlockedBanners.includes(banner.id);
              const isEquipped = equippedBanner === banner.id;
              const isPreviewing = previewBannerId === banner.id;
              const canAfford = frostXp >= banner.frostXpCost;

              return (
                <div
                  key={banner.id}
                  className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-colors ${
                    isEquipped
                      ? 'border-sky-400 bg-sky-500/10'
                      : isUnlocked
                      ? 'border-sky-500/35 bg-slate-900/70'
                      : 'border-white/10 bg-slate-950/60'
                  }`}
                >
                  <div>
                    <ProfileBannerBackdrop equippedBanner={banner.id} className="h-20 w-full">
                      <div className="p-2.5 h-full flex items-end justify-between">
                        <ProfileCosmeticAvatar
                          name={currentUser.name}
                          avatarUrl={currentUser.photoURL || currentUser.avatar}
                          equippedBorder={activeBorderForPreview}
                          size="sm"
                        />
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-950/75 text-slate-100 border border-white/15">
                          {banner.rarity}
                        </span>
                      </div>
                    </ProfileBannerBackdrop>

                    <div className="p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-white truncate">{banner.name}</p>
                        <span
                          className={`text-[10px] font-bold shrink-0 ${
                            isEquipped
                              ? 'text-sky-300'
                              : isUnlocked
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {isEquipped ? 'Equipped' : isUnlocked ? 'Owned' : 'Locked'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{banner.description}</p>
                      <p className="text-[10px] text-slate-500">
                        Unlock: {banner.unlockRequirement}
                        {banner.purchasableWithFrostXp && !isUnlocked ? ` · ${banner.frostXpCost} Frost XP` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="px-3 pb-3 pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onPreviewBannerChange(isPreviewing ? null : banner.id)}
                      className={`min-h-[44px] px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                        isPreviewing
                          ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                          : 'border-white/15 bg-slate-900 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isPreviewing ? 'Unpreview' : 'Preview'}</span>
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isUnlocked ? (
                        <TactileButton
                          variant={isEquipped ? 'secondary' : 'primary'}
                          size="sm"
                          className="min-h-[44px]"
                          disabled={busyKey === `equip_banner:${banner.id}`}
                          onClick={() => handleEquipBanner(isEquipped ? null : banner.id)}
                        >
                          {isEquipped ? 'Unequip' : 'Equip'}
                        </TactileButton>
                      ) : (
                        <>
                          {banner.purchasableWithFrostXp && (
                            <TactileButton
                              variant={canAfford ? 'primary' : 'outline'}
                              size="sm"
                              className="min-h-[44px]"
                              disabled={!canAfford || busyKey === `buy:banner:${banner.id}`}
                              onClick={() => setPurchaseConfirm({ itemType: 'banner', item: banner })}
                              icon={<ShoppingBag className="w-3.5 h-3.5" />}
                            >
                              {banner.frostXpCost} Frost XP
                            </TactileButton>
                          )}
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setPurchaseConfirm({ itemType: 'banner', item: banner })}
                              className="min-h-[44px] px-2.5 py-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 cursor-pointer"
                            >
                              Claim Free
                            </button>
                          )}
                          {!banner.purchasableWithFrostXp && !isSuperAdmin && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 px-1.5">
                              <Lock className="w-3 h-3" /> Drop Exclusive
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION: WINTER PROFILE BORDERS (AVATAR PERIMETER) */}
      {showBorders && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-sky-300">
                Winter Collectible Profile Borders (Avatar Perimeter)
              </h4>
              <p className="text-[11px] text-slate-400">
                Follows your avatar contour cleanly and stacks with your active Banner.
              </p>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-sky-300 font-bold">
              {unlockedBorders.length} / {(winterStatus.borders || []).length} Owned
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(winterStatus.borders || []).map((border) => {
              const isUnlocked = unlockedBorders.includes(border.id);
              const isEquipped = equippedBorder === border.id;
              const isPreviewing = previewBorderId === border.id;
              const canAfford = frostXp >= border.frostXpCost;

              return (
                <div
                  key={border.id}
                  className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                    isEquipped
                      ? 'border-sky-400 bg-sky-500/10'
                      : isUnlocked
                      ? 'border-sky-500/35 bg-slate-900/70'
                      : 'border-white/10 bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <ProfileCosmeticAvatar
                      name={currentUser.name}
                      avatarUrl={currentUser.photoURL || currentUser.avatar}
                      equippedBorder={border.id}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-white truncate">{border.name}</p>
                        <span
                          className={`text-[10px] font-bold shrink-0 ${
                            isEquipped
                              ? 'text-sky-300'
                              : isUnlocked
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {isEquipped ? 'Equipped' : isUnlocked ? 'Owned' : 'Locked'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{border.description}</p>
                      <p className="text-[10px] text-slate-500">
                        Unlock: {border.unlockRequirement}
                        {border.purchasableWithFrostXp && !isUnlocked ? ` · ${border.frostXpCost} Frost XP` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onPreviewBorderChange(isPreviewing ? null : border.id)}
                      className={`min-h-[44px] px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                        isPreviewing
                          ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                          : 'border-white/15 bg-slate-900 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isPreviewing ? 'Unpreview' : 'Preview'}</span>
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isUnlocked ? (
                        <TactileButton
                          variant={isEquipped ? 'secondary' : 'primary'}
                          size="sm"
                          className="min-h-[44px]"
                          disabled={busyKey === `equip_border:${border.id}`}
                          onClick={() => handleEquipBorder(isEquipped ? null : border.id)}
                        >
                          {isEquipped ? 'Unequip' : 'Equip'}
                        </TactileButton>
                      ) : (
                        <>
                          {border.purchasableWithFrostXp && (
                            <TactileButton
                              variant={canAfford ? 'primary' : 'outline'}
                              size="sm"
                              className="min-h-[44px]"
                              disabled={!canAfford || busyKey === `buy:border:${border.id}`}
                              onClick={() => setPurchaseConfirm({ itemType: 'border', item: border })}
                              icon={<ShoppingBag className="w-3.5 h-3.5" />}
                            >
                              {border.frostXpCost} Frost XP
                            </TactileButton>
                          )}
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setPurchaseConfirm({ itemType: 'border', item: border })}
                              className="min-h-[44px] px-2.5 py-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 cursor-pointer"
                            >
                              Claim Free
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION: WINTER COLLECTIBLE BADGES */}
      {showBadges && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-sky-300">
                Winter Collectible Badges
              </h4>
              <p className="text-[11px] text-slate-400">
                Earned and locked seasonal milestone badges for your public profile.
              </p>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-sky-300 font-bold">
              {(winterStatus.badges || []).filter((b) => Boolean(b.unlockedAt)).length} /{' '}
              {(winterStatus.badges || []).length} Earned
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {(winterStatus.badges || []).map((badge) => {
              const unlocked = Boolean(badge.unlockedAt);
              return (
                <div
                  key={badge.id}
                  className={`rounded-xl border p-3 space-y-1 ${
                    unlocked
                      ? 'border-sky-400/45 bg-sky-500/10'
                      : 'border-white/10 bg-slate-950/60 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white inline-flex items-center gap-1.5 truncate">
                      {unlocked ? (
                        <Award className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span className="truncate">{badge.name}</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0">
                      {unlocked ? 'Owned' : 'Locked'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{badge.description}</p>
                  <p className="text-[10px] text-slate-500 truncate">{badge.unlockRequirement}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Purchase / Audited Super Admin Claim Confirmation Dialog */}
      <AnimatedDialog
        isOpen={Boolean(purchaseConfirm)}
        onClose={() => !busyKey && setPurchaseConfirm(null)}
        title={purchaseConfirm?.item.name || 'Unlock Collectible'}
        subtitle={
          purchaseConfirm?.itemType === 'banner'
            ? 'Winter Profile Banner (Background Artwork)'
            : 'Winter Profile Border (Avatar Perimeter)'
        }
        maxWidth="max-w-md"
      >
        {purchaseConfirm && (
          <div className="space-y-4">
            {purchaseConfirm.itemType === 'banner' ? (
              <ProfileBannerBackdrop equippedBanner={purchaseConfirm.item.id} className="h-24 w-full rounded-xl">
                <div className="p-3 h-full flex items-end">
                  <ProfileCosmeticAvatar
                    name={currentUser.name}
                    avatarUrl={currentUser.photoURL || currentUser.avatar}
                    equippedBorder={activeBorderForPreview}
                    size="md"
                  />
                </div>
              </ProfileBannerBackdrop>
            ) : (
              <div className="flex justify-center py-3">
                <ProfileCosmeticAvatar
                  name={currentUser.name}
                  avatarUrl={currentUser.photoURL || currentUser.avatar}
                  equippedBorder={purchaseConfirm.item.id}
                  size="lg"
                />
              </div>
            )}
            <p className="text-xs text-slate-300 leading-relaxed">{purchaseConfirm.item.description}</p>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-slate-400">Your Frost XP</span>
              <span className="text-cyan-300 font-bold">{frostXp} Frost XP</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <TactileButton
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={() => setPurchaseConfirm(null)}
                disabled={Boolean(busyKey)}
              >
                Cancel
              </TactileButton>
              {purchaseConfirm.item.purchasableWithFrostXp && (
                <TactileButton
                  variant="primary"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={Boolean(busyKey) || frostXp < purchaseConfirm.item.frostXpCost}
                  onClick={() => handleConfirmPurchase(false)}
                >
                  {busyKey ? 'Unlocking...' : `Confirm (${purchaseConfirm.item.frostXpCost} Frost XP)`}
                </TactileButton>
              )}
              {isSuperAdmin && (
                <TactileButton
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={Boolean(busyKey)}
                  onClick={() => handleConfirmPurchase(true)}
                >
                  {busyKey ? 'Granting...' : 'Super Admin Claim Free (Audited)'}
                </TactileButton>
              )}
            </div>
          </div>
        )}
      </AnimatedDialog>
    </div>
  );
};
