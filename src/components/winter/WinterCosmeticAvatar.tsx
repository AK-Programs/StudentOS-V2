/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Avatar Wrapper delegating directly to centralized ProfileCosmeticAvatar.
 * Supports Winter Perimeter Borders stacked cleanly with permanent non-Winter AVATAR_FRAMES.
 */

import React from 'react';
import {
  CosmeticAvatarShape,
  CosmeticAvatarSize,
  ProfileCosmeticAvatar,
} from './ProfileCosmeticRenderer';

export type AvatarCosmeticSize = CosmeticAvatarSize;

interface WinterCosmeticAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  equippedBorder?: string | null;
  permanentFrameClass?: string | null;
  size?: AvatarCosmeticSize;
  shape?: CosmeticAvatarShape;
  className?: string;
  fallbackBgClass?: string;
}

export const WinterCosmeticAvatar: React.FC<WinterCosmeticAvatarProps> = ({
  name,
  avatarUrl,
  equippedBorder,
  permanentFrameClass,
  size = 'sm',
  shape = 'circle',
  className = '',
  fallbackBgClass,
}) => {
  return (
    <ProfileCosmeticAvatar
      name={name}
      avatarUrl={avatarUrl}
      equippedBorder={equippedBorder}
      permanentFrameClass={permanentFrameClass}
      size={size}
      shape={shape}
      className={className}
      fallbackBgClass={fallbackBgClass}
    />
  );
};
