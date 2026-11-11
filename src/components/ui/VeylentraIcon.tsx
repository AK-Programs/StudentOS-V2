/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Unified Tactile & 3D Icon Component
 * Maps high-fidelity tactile icon assets extracted from the application design system
 * to standard UI contexts, maintaining sharp rendering and semantic consistency.
 */

import React from 'react';

export type VeylentraIconName =
  | 'dashboard'
  | 'timetable'
  | 'calendar'
  | 'schedule'
  | 'attendance'
  | 'tasks'
  | 'homework'
  | 'notes'
  | 'editor'
  | 'settings'
  | 'admin'
  | 'whats_new'
  | 'announcements'
  | 'chat'
  | 'peer_chat'
  | 'sprout'
  | 'growth'
  | 'search'
  | 'merit'
  | 'award'
  | 'study_suite'
  | 'study_hub'
  | 'pomodoro'
  | 'timer'
  | 'target'
  | 'materials'
  | 'library'
  | 'books'
  | 'trophy'
  | 'brain_battle'
  | 'quiz'
  | 'ai_tutor'
  | 'byte'
  | 'lightbulb'
  | 'flame'
  | 'streak'
  | 'star'
  | 'clover'
  | 'rewards'
  | 'analytics'
  | 'check'
  | 'bell'
  | 'upload'
  | 'sliders'
  | 'lock'
  | 'user'
  | 'folder'
  | 'send';

const ICON_ASSET_MAP: Record<VeylentraIconName, string> = {
  dashboard: '/assets/icons/clay_dashboard.png',
  timetable: '/assets/icons/icon_1.jpg',
  calendar: '/assets/icons/icon_1.jpg',
  schedule: '/assets/icons/icon_1.jpg',
  attendance: '/assets/icons/icon_2.jpg',
  tasks: '/assets/icons/icon_2.jpg',
  homework: '/assets/icons/icon_2.jpg',
  notes: '/assets/icons/icon_3.jpg',
  editor: '/assets/icons/icon_3.jpg',
  settings: '/assets/icons/icon_4.jpg',
  admin: '/assets/icons/icon_4.jpg',
  whats_new: '/assets/icons/icon_7.jpg',
  announcements: '/assets/icons/icon_7.jpg',
  chat: '/assets/icons/icon_8.jpg',
  peer_chat: '/assets/icons/icon_8.jpg',
  sprout: '/assets/icons/icon_9.jpg',
  growth: '/assets/icons/icon_9.jpg',
  search: '/assets/icons/icon_10.jpg',
  merit: '/assets/icons/icon_11.jpg',
  award: '/assets/icons/icon_11.jpg',
  study_suite: '/assets/icons/icon_12.jpg',
  study_hub: '/assets/icons/icon_12.jpg',
  pomodoro: '/assets/icons/icon_13.jpg',
  timer: '/assets/icons/icon_13.jpg',
  target: '/assets/icons/icon_13.jpg',
  materials: '/assets/icons/icon_14.jpg',
  library: '/assets/icons/icon_14.jpg',
  books: '/assets/icons/icon_14.jpg',
  trophy: '/assets/icons/icon_16.jpg',
  brain_battle: '/assets/icons/icon_16.jpg',
  quiz: '/assets/icons/icon_16.jpg',
  ai_tutor: '/assets/icons/icon_17.jpg',
  byte: '/assets/icons/icon_17.jpg',
  lightbulb: '/assets/icons/icon_17.jpg',
  flame: '/assets/icons/icon_18.jpg',
  streak: '/assets/icons/icon_18.jpg',
  star: '/assets/icons/icon_19.jpg',
  clover: '/assets/icons/icon_20.jpg',
  rewards: '/assets/icons/icon_20.jpg',
  analytics: '/assets/icons/clay_analytics.png',
  check: '/assets/icons/clay_check.png',
  bell: '/assets/icons/clay_bell.png',
  upload: '/assets/icons/clay_upload.png',
  sliders: '/assets/icons/clay_sliders.png',
  lock: '/assets/icons/clay_lock.png',
  user: '/assets/icons/clay_user.png',
  folder: '/assets/icons/clay_folder.png',
  send: '/assets/icons/clay_send.png'
};

export interface VeylentraIconProps {
  name: VeylentraIconName;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  alt?: string;
  glow?: boolean;
}

export const VeylentraIcon: React.FC<VeylentraIconProps> = ({
  name,
  size = 'md',
  className = '',
  alt,
  glow = false
}) => {
  const src = ICON_ASSET_MAP[name] || ICON_ASSET_MAP.dashboard;

  let sizeClasses = 'w-5 h-5';
  let inlineSizeStyle: React.CSSProperties = {};

  if (typeof size === 'number') {
    inlineSizeStyle = { width: `${size}px`, height: `${size}px` };
    sizeClasses = '';
  } else {
    switch (size) {
      case 'xs':
        sizeClasses = 'w-3.5 h-3.5';
        break;
      case 'sm':
        sizeClasses = 'w-4 h-4';
        break;
      case 'md':
        sizeClasses = 'w-5 h-5';
        break;
      case 'lg':
        sizeClasses = 'w-7 h-7';
        break;
      case 'xl':
        sizeClasses = 'w-10 h-10';
        break;
    }
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-lg overflow-hidden select-none pointer-events-none transition-transform duration-200 ${sizeClasses} ${
        glow ? 'drop-shadow-[0_2px_8px_rgba(37,99,235,0.35)]' : ''
      } ${className}`}
      style={inlineSizeStyle}
    >
      <img
        src={src}
        alt={alt || `${name} icon`}
        className="w-full h-full object-cover rounded-md"
        loading="lazy"
        draggable={false}
      />
    </span>
  );
};
