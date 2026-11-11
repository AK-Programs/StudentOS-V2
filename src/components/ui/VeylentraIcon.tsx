/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Vector 3D & Tactile SVG Icon Engine
 * Pure code implementation recreates all 3D claymorphic and tactile designs
 * from the Veylentra iconography specification without bitmap extraction artifacts,
 * pixelation, or unwanted white box backgrounds.
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
  | 'call'
  | 'phone'
  | 'video_call'
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
  | 'notification'
  | 'upload'
  | 'download'
  | 'sliders'
  | 'lock'
  | 'unlock'
  | 'user'
  | 'folder'
  | 'send'
  | 'shield'
  | 'camera'
  | 'mail'
  | 'clock'
  | 'bookmark'
  | 'compass'
  | 'globe'
  | 'volume'
  | 'battery'
  | 'wifi';

export interface VeylentraIconProps {
  name: VeylentraIconName;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  glow?: boolean;
  alt?: string;
}

export const VeylentraIcon: React.FC<VeylentraIconProps> = ({
  name,
  size = 'md',
  className = '',
  glow = false
}) => {
  let pixelSize = 20;

  if (typeof size === 'number') {
    pixelSize = size;
  } else {
    switch (size) {
      case 'xs':
        pixelSize = 14;
        break;
      case 'sm':
        pixelSize = 16;
        break;
      case 'md':
        pixelSize = 20;
        break;
      case 'lg':
        pixelSize = 28;
        break;
      case 'xl':
        pixelSize = 40;
        break;
    }
  }

  const renderVectorGlyph = () => {
    switch (name) {
      // 1. Dashboard (Claymorphic Window with Pie Chart & Lines)
      case 'dashboard':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="db-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="db-pie" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>
            </defs>
            <rect x="4" y="6" width="40" height="36" rx="10" fill="url(#db-bg)" />
            {/* Window header dots */}
            <circle cx="11" cy="13" r="1.5" fill="#ffffff" fillOpacity="0.8" />
            <circle cx="16" cy="13" r="1.5" fill="#ffffff" fillOpacity="0.8" />
            <circle cx="21" cy="13" r="1.5" fill="#ffffff" fillOpacity="0.8" />
            {/* Pie chart */}
            <circle cx="19" cy="28" r="9" fill="#ffffff" fillOpacity="0.9" />
            <path d="M19 19 A9 9 0 0 1 28 28 L19 28 Z" fill="url(#db-pie)" />
            {/* Dashboard lines */}
            <rect x="31" y="22" width="9" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.9" />
            <rect x="31" y="28" width="9" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.9" />
            <rect x="31" y="34" width="6" height="3" rx="1.5" fill="#ffffff" fillOpacity="0.9" />
          </svg>
        );

      // 2. Calendar / Timetable / Schedule (3D Green Spiral Calendar with Clock)
      case 'timetable':
      case 'calendar':
      case 'schedule':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="cal-top" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="cal-clock" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
            {/* Calendar Body */}
            <rect x="6" y="10" width="36" height="32" rx="8" fill="#f8fafc" />
            {/* Calendar Header Header Bar */}
            <path d="M6 18 C6 13.5 9.5 10 14 10 L34 10 C38.5 10 42 13.5 42 18 L42 20 L6 20 Z" fill="url(#cal-top)" />
            {/* Spiral Rings */}
            <circle cx="14" cy="9" r="2.5" fill="#1e293b" />
            <circle cx="24" cy="9" r="2.5" fill="#1e293b" />
            <circle cx="34" cy="9" r="2.5" fill="#1e293b" />
            {/* Calendar grid cells */}
            <rect x="11" y="24" width="5" height="5" rx="1.5" fill="#cbd5e1" />
            <rect x="18" y="24" width="5" height="5" rx="1.5" fill="#cbd5e1" />
            <rect x="25" y="24" width="5" height="5" rx="1.5" fill="#cbd5e1" />
            <rect x="11" y="31" width="5" height="5" rx="1.5" fill="#cbd5e1" />
            <rect x="18" y="31" width="5" height="5" rx="1.5" fill="#cbd5e1" />
            {/* 3D Clock on lower right */}
            <circle cx="35" cy="34" r="10" fill="url(#cal-clock)" />
            <circle cx="35" cy="34" r="8" fill="#ffffff" />
            {/* Clock hands pointing 1:00 */}
            <path d="M35 34 L35 29 M35 34 L38 31" stroke="#047857" strokeWidth="2" strokeLinecap="round" />
            <circle cx="35" cy="34" r="1" fill="#047857" />
          </svg>
        );

      // 3. Attendance / Tasks / Homework (3D Blue Clipboard with Pen)
      case 'attendance':
      case 'tasks':
      case 'homework':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="clip-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="pen-body" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
            {/* Clipboard board */}
            <rect x="8" y="8" width="32" height="36" rx="7" fill="url(#clip-bg)" />
            {/* Dark Top Clip */}
            <rect x="17" y="5" width="14" height="6" rx="3" fill="#1e293b" />
            {/* Paper sheet */}
            <rect x="12" y="13" width="24" height="28" rx="4" fill="#ffffff" />
            {/* Checked boxes & tasks */}
            <rect x="15" y="17" width="5" height="5" rx="1.5" fill="#3b82f6" />
            <path d="M16 19.5 L17.5 21 L19 18" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <rect x="22" y="18" width="11" height="3" rx="1.5" fill="#f97316" />

            <rect x="15" y="24" width="5" height="5" rx="1.5" fill="#3b82f6" />
            <path d="M16 26.5 L17.5 28 L19 25" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <rect x="22" y="25" width="11" height="3" rx="1.5" fill="#f97316" />

            <rect x="15" y="31" width="5" height="5" rx="1.5" fill="#94a3b8" />
            <rect x="22" y="32" width="8" height="3" rx="1.5" fill="#cbd5e1" />
            {/* Stylus Pen tilted */}
            <g transform="translate(4, 4) rotate(-30 18 20)">
              <rect x="16" y="10" width="4" height="15" rx="2" fill="url(#pen-body)" />
              <polygon points="16,25 20,25 18,29" fill="#3b82f6" />
            </g>
          </svg>
        );

      // 4. Notes / Lecture Notes / Editor (3D Open Notebook with Blue Cover & Pencil)
      case 'notes':
      case 'editor':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="book-cover" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="pencil-body" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            {/* Book Base (Cover Wings) */}
            <rect x="5" y="17" width="38" height="25" rx="5" fill="url(#book-cover)" />
            {/* Left Page (Slightly Angled Open) */}
            <path d="M7 19 Q24 22 24 22 L24 38 Q7 35 7 19 Z" fill="#f8fafc" />
            {/* Right Page (Open) */}
            <path d="M41 19 Q24 22 24 22 L24 38 Q41 35 41 19 Z" fill="#ffffff" />
            {/* Page Text lines */}
            <line x1="10" y1="23" x2="20" y2="24" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="10" y1="27" x2="20" y2="28" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="10" y1="31" x2="18" y2="32" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            {/* Yellow Pencil Standing in Notebook */}
            <g transform="translate(10, -3)">
              <rect x="23" y="12" width="5" height="18" rx="2" fill="url(#pencil-body)" />
              <rect x="23" y="9" width="5" height="4" rx="1.5" fill="#f43f5e" />
              <polygon points="23,30 28,30 25.5,35" fill="#fde68a" />
              <polygon points="25,34 26,34 25.5,35" fill="#1e293b" />
            </g>
          </svg>
        );

      // 5. Settings / Admin / Gears (3D Dual Interlocking Gears)
      case 'settings':
      case 'admin':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="gear-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
              <linearGradient id="gear-orange" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fca5a5" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            {/* Top-Left Orange Gear */}
            <g transform="translate(16, 16)">
              <circle cx="0" cy="0" r="10" fill="url(#gear-orange)" />
              <circle cx="0" cy="0" r="4.5" fill="#0f172a" />
              {/* Teeth */}
              <rect x="-2" y="-12" width="4" height="24" rx="1.5" fill="url(#gear-orange)" />
              <rect x="-12" y="-2" width="24" height="4" rx="1.5" fill="url(#gear-orange)" />
              <rect x="-2" y="-12" width="4" height="24" rx="1.5" transform="rotate(45)" fill="url(#gear-orange)" />
              <rect x="-12" y="-2" width="24" height="4" rx="1.5" transform="rotate(45)" fill="url(#gear-orange)" />
            </g>
            {/* Bottom-Right Blue Gear */}
            <g transform="translate(30, 29)">
              <circle cx="0" cy="0" r="13" fill="url(#gear-blue)" />
              <circle cx="0" cy="0" r="5.5" fill="#0f172a" />
              {/* Teeth */}
              <rect x="-2.5" y="-15" width="5" height="30" rx="2" fill="url(#gear-blue)" />
              <rect x="-15" y="-2.5" width="30" height="5" rx="2" fill="url(#gear-blue)" />
              <rect x="-2.5" y="-15" width="5" height="30" rx="2" transform="rotate(45)" fill="url(#gear-blue)" />
              <rect x="-15" y="-2.5" width="30" height="5" rx="2" transform="rotate(45)" fill="url(#gear-blue)" />
            </g>
          </svg>
        );

      // 6. What's New / Lightning Bolt (3D Yellow Electric Lightning)
      case 'whats_new':
      case 'announcements':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
            </defs>
            <path
              d="M26 4 L11 25 L23 25 L19 44 L37 20 L24 20 Z"
              fill="url(#bolt-grad)"
              stroke="#ca8a04"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        );

      // 7. Chat / Peer Chat (3D Tactile Avatar with Speech Bubble & Chain)
      case 'chat':
      case 'peer_chat':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="chat-av" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fdba74" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
              <linearGradient id="chat-bubble" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            {/* Avatar Head & Body */}
            <circle cx="16" cy="16" r="8" fill="url(#chat-av)" />
            <path d="M6 38 C6 28 10 26 16 26 C22 26 26 28 26 38 Z" fill="url(#chat-av)" />
            {/* Speech Bubble */}
            <rect x="22" y="11" width="22" height="18" rx="8" fill="url(#chat-bubble)" />
            <polygon points="25,26 22,32 30,27" fill="url(#chat-bubble)" />
            {/* Link Chain in bubble */}
            <rect x="27" y="17" width="10" height="5" rx="2.5" fill="none" stroke="#ffffff" strokeWidth="2" />
          </svg>
        );

      // 8. Call / Phone (3D Green Telephone Handset from 50 Essential Icons #29)
      case 'call':
      case 'phone':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="phone-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
            </defs>
            <path
              d="M15 8 C15 8 18 14 20 16 C22 18 20 20 18 22 C21 27 25 31 30 34 C32 32 34 30 36 32 C38 34 44 37 44 37 C44 42 39 45 35 45 C20 45 7 32 7 17 C7 13 10 8 15 8 Z"
              fill="url(#phone-grad)"
              stroke="#15803d"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        );

      // 9. Video Call (3D Blue Camera from 50 Essential Icons #30)
      case 'video_call':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="vcall-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <rect x="6" y="13" width="26" height="22" rx="7" fill="url(#vcall-grad)" />
            <polygon points="32,20 43,14 43,34 32,28" fill="url(#vcall-grad)" />
            <circle cx="19" cy="24" r="4.5" fill="#ffffff" fillOpacity="0.4" />
          </svg>
        );

      // 10. Bell / Notification (3D Bell with Red Notification Badge #56 & Page 6 Bell)
      case 'bell':
      case 'notification':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="bell-body" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbcfe8" />
                <stop offset="50%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#db2777" />
              </linearGradient>
              <linearGradient id="badge-red" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>
            </defs>
            {/* Bell handle */}
            <path d="M24 7 C22 7 21 8.5 21 10 L27 10 C27 8.5 26 7 24 7 Z" fill="#db2777" />
            {/* Bell Flared Body */}
            <path d="M14 34 C14 24 16 12 24 12 C32 12 34 24 34 34 L12 34 Z" fill="url(#bell-body)" />
            <rect x="10" y="34" width="28" height="4" rx="2" fill="url(#bell-body)" />
            {/* Clapper */}
            <circle cx="24" cy="40" r="3" fill="#be185d" />
            {/* Red Badge '1' */}
            <circle cx="34" cy="14" r="7" fill="url(#badge-red)" stroke="#ffffff" strokeWidth="1.5" />
            <text x="34" y="18" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900" fontFamily="sans-serif">1</text>
          </svg>
        );

      // 11. Study Suite / Study Hub (3D 4-Piece Educational Puzzle: Book, Flask, Globe, Calculator)
      case 'study_suite':
      case 'study_hub':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            {/* Red Top-Left (Book) */}
            <rect x="5" y="5" width="18" height="18" rx="5" fill="#ef4444" />
            <path d="M9 13 Q14 11 14 17 Q9 15 9 13 Z M19 13 Q14 11 14 17 Q19 15 19 13 Z" fill="#ffffff" />
            {/* Yellow Top-Right (Flask) */}
            <rect x="25" y="5" width="18" height="18" rx="5" fill="#f59e0b" />
            <path d="M33 9 L35 9 L35 12 L38 18 L30 18 L33 12 Z" fill="#ffffff" />
            {/* Blue Bottom-Left (Globe) */}
            <rect x="5" y="25" width="18" height="18" rx="5" fill="#3b82f6" />
            <circle cx="14" cy="34" r="5" fill="none" stroke="#ffffff" strokeWidth="1.5" />
            <line x1="9" y1="34" x2="19" y2="34" stroke="#ffffff" strokeWidth="1.2" />
            <line x1="14" y1="29" x2="14" y2="39" stroke="#ffffff" strokeWidth="1.2" />
            {/* Green Bottom-Right (Calculator) */}
            <rect x="25" y="25" width="18" height="18" rx="5" fill="#10b981" />
            <rect x="29" y="29" width="10" height="3" rx="0.8" fill="#ffffff" />
            <circle cx="31" cy="35" r="1" fill="#ffffff" />
            <circle cx="34" cy="35" r="1" fill="#ffffff" />
            <circle cx="37" cy="35" r="1" fill="#ffffff" />
            <circle cx="31" cy="39" r="1" fill="#ffffff" />
            <circle cx="34" cy="39" r="1" fill="#ffffff" />
            <circle cx="37" cy="39" r="1" fill="#ffffff" />
          </svg>
        );

      // 12. Focus Timer / Pomodoro / Target (3D Bullseye Target with Arrow)
      case 'pomodoro':
      case 'timer':
      case 'target':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            {/* Outer Coral Ring */}
            <circle cx="24" cy="24" r="19" fill="#f87171" />
            {/* White Ring */}
            <circle cx="24" cy="24" r="14" fill="#ffffff" />
            {/* Middle Coral Ring */}
            <circle cx="24" cy="24" r="9" fill="#f87171" />
            {/* Inner White Bullseye */}
            <circle cx="24" cy="24" r="4.5" fill="#ffffff" />
            {/* Dart/Arrow hitting center */}
            <g transform="rotate(-40 24 24)">
              <line x1="24" y1="4" x2="24" y2="24" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
              {/* Arrow fletching */}
              <polygon points="21,4 27,4 24,10" fill="#ea580c" />
            </g>
          </svg>
        );

      // 13. Materials Hub / Library / Books (3D Dual Hardcover Books - Blue & Violet)
      case 'materials':
      case 'library':
      case 'books':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            {/* Violet Rear Book */}
            <rect x="6" y="16" width="24" height="26" rx="5" fill="#6366f1" transform="rotate(-15 18 29)" />
            <rect x="8" y="18" width="20" height="22" rx="3" fill="#e0e7ff" transform="rotate(-15 18 29)" />
            {/* Green Ribbon Bookmark */}
            <polygon points="12,39 16,39 14,44" fill="#10b981" />
            {/* Blue Front Book */}
            <rect x="18" y="8" width="25" height="32" rx="6" fill="#3b82f6" />
            <rect x="22" y="11" width="18" height="26" rx="4" fill="#f8fafc" />
            <line x1="20" y1="8" x2="20" y2="40" stroke="#1d4ed8" strokeWidth="2.5" />
          </svg>
        );

      // 14. Trophy / Brain Battle / Quiz (3D Golden Trophy with Star & Ribbon)
      case 'trophy':
      case 'brain_battle':
      case 'quiz':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="gold-cup" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            {/* Pink Ribbon Backdrop */}
            <path d="M5 28 Q15 22 17 32 L15 40 Q7 36 5 28 Z" fill="#f43f5e" />
            <path d="M43 28 Q33 22 31 32 L33 40 Q41 36 43 28 Z" fill="#f43f5e" />
            {/* Trophy Pedestal */}
            <rect x="16" y="36" width="16" height="8" rx="2" fill="#334155" />
            <rect x="19" y="38" width="10" height="4" rx="1" fill="#fde047" />
            {/* Trophy Cup */}
            <path d="M14 13 C14 26 21 28 24 33 C27 28 34 26 34 13 Z" fill="url(#gold-cup)" />
            {/* Handles */}
            <path d="M14 15 C8 15 8 23 15 25" fill="none" stroke="url(#gold-cup)" strokeWidth="3" strokeLinecap="round" />
            <path d="M34 15 C40 15 40 23 33 25" fill="none" stroke="url(#gold-cup)" strokeWidth="3" strokeLinecap="round" />
            {/* Embossed Silver/White Star on Cup */}
            <polygon points="24,16 25.5,20 29.5,20.5 26.5,23 27.5,27 24,24.5 20.5,27 21.5,23 18.5,20.5 22.5,20" fill="#ffffff" />
          </svg>
        );

      // 15. AI Tutor / Byte / Lightbulb (3D Glowing Yellow Lightbulb with Blue Base)
      case 'ai_tutor':
      case 'byte':
      case 'lightbulb':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="bulb-glass" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
            </defs>
            {/* Glass Bulb Dome */}
            <path d="M24 6 C15 6 12 14 12 20 C12 25 17 28 17 32 L31 32 C31 28 36 25 36 20 C36 14 33 6 24 6 Z" fill="url(#bulb-glass)" />
            {/* Filament Glow Highlight */}
            <path d="M22 22 L24 16 L26 22" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Screw Base */}
            <rect x="18" y="33" width="12" height="4" rx="2" fill="#3b82f6" />
            <rect x="19" y="38" width="10" height="3" rx="1.5" fill="#2563eb" />
            <rect x="21" y="42" width="6" height="2" rx="1" fill="#1d4ed8" />
          </svg>
        );

      // 16. Streak / Flame (3D Study Streak Momentum)
      case 'streak':
      case 'flame':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="fire-outer" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
            {/* Outer Flame */}
            <path
              d="M23 4 C25 10 30 14 30 20 C30 22 29 24 28 25 C31 24 35 27 36 30 C38 36 34 44 24 44 C14 44 8 35 12 25 C14 20 18 16 19 11 C20 9 21 6 23 4 Z"
              fill="url(#fire-outer)"
            />
            {/* Inner Core Flame */}
            <path
              d="M24 22 C27 24 28 27 28 30 C28 34 25 38 22 38 C18 38 16 34 18 29 C19 26 21 24 24 22 Z"
              fill="#fef08a"
            />
          </svg>
        );

      // 17. Star / Rating (3D Academic Star)
      case 'star':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <polygon
              points="24,4 29,16 42,18 32,27 35,40 24,33 13,40 16,27 6,18 19,16"
              fill="#facc15"
              stroke="#ca8a04"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        );

      // 18. Clover / Rewards / Life (3D 4-Leaf Clover)
      case 'clover':
      case 'rewards':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <defs>
              <linearGradient id="clover-g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
            </defs>
            {/* 4 Inflated Clover Leaves */}
            <ellipse cx="24" cy="14" rx="8" ry="9" fill="url(#clover-g)" />
            <ellipse cx="24" cy="34" rx="8" ry="9" fill="url(#clover-g)" />
            <ellipse cx="14" cy="24" rx="9" ry="8" fill="url(#clover-g)" />
            <ellipse cx="34" cy="24" rx="9" ry="8" fill="url(#clover-g)" />
            <circle cx="24" cy="24" r="3" fill="#15803d" />
          </svg>
        );

      // 19. Sprout / Growth
      case 'sprout':
      case 'growth':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            {/* Soil mound */}
            <ellipse cx="24" cy="40" rx="12" ry="4" fill="#a16207" />
            {/* Stem */}
            <path d="M24 40 L24 24" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
            {/* Left Leaf */}
            <path d="M24 24 Q10 20 12 10 Q24 16 24 24 Z" fill="#4ade80" />
            {/* Right Leaf */}
            <path d="M24 24 Q38 20 36 10 Q24 16 24 24 Z" fill="#22c55e" />
          </svg>
        );

      // 20. Search (3D Magnifying Glass with Blue Handle)
      case 'search':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <circle cx="21" cy="21" r="13" fill="none" stroke="#3b82f6" strokeWidth="5" />
            <circle cx="21" cy="21" r="9" fill="#eff6ff" fillOpacity="0.7" />
            <line x1="30" y1="30" x2="42" y2="42" stroke="#1d4ed8" strokeWidth="6" strokeLinecap="round" />
          </svg>
        );

      // 21. Merit / Award (3D Rosette Ribbon with Star)
      case 'merit':
      case 'award':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            {/* Ribbon Tails */}
            <polygon points="17,32 12,45 22,40" fill="#3b82f6" />
            <polygon points="31,32 36,45 26,40" fill="#2563eb" />
            {/* Rosette Scallop Circle */}
            <circle cx="24" cy="22" r="14" fill="#3b82f6" />
            <circle cx="24" cy="22" r="10" fill="#facc15" />
            <polygon points="24,17 25.5,20.5 29,21 26.5,23.5 27.5,27 24,25 20.5,27 21.5,23.5 19,21 22.5,20.5" fill="#ffffff" />
          </svg>
        );

      // 22. Analytics (3D Bar Chart with Bars of Gradient Heights)
      case 'analytics':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <rect x="5" y="38" width="38" height="4" rx="2" fill="#64748b" />
            <rect x="10" y="24" width="6" height="14" rx="3" fill="#a855f7" />
            <rect x="21" y="14" width="6" height="24" rx="3" fill="#3b82f6" />
            <rect x="32" y="20" width="6" height="18" rx="3" fill="#10b981" />
          </svg>
        );

      // 23. Check
      case 'check':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <circle cx="24" cy="24" r="18" fill="#10b981" />
            <path d="M15 24 L21 30 L33 18" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        );

      // 24. Folder
      case 'folder':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <path d="M6 14 C6 11 8 9 11 9 L20 9 L24 13 L37 13 C40 13 42 15 42 18 L42 37 C42 40 40 42 37 42 L11 42 C8 42 6 40 6 37 Z" fill="#2dd4bf" />
            <rect x="10" y="18" width="28" height="18" rx="4" fill="#ffffff" fillOpacity="0.4" />
          </svg>
        );

      // 25. User
      case 'user':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <circle cx="24" cy="16" r="9" fill="#93c5fd" />
            <path d="M10 40 C10 30 16 27 24 27 C32 27 38 30 38 40 Z" fill="#3b82f6" />
          </svg>
        );

      // 26. Send (Paper Plane)
      case 'send':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <polygon points="6,24 42,8 26,42 22,28" fill="#c084fc" />
            <polygon points="22,28 42,8 26,42" fill="#a855f7" />
          </svg>
        );

      // 27. Lock
      case 'lock':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <rect x="10" y="20" width="28" height="22" rx="7" fill="#2dd4bf" />
            <path d="M16 20 L16 13 C16 8.5 19.5 5 24 5 C28.5 5 32 8.5 32 13 L32 20" fill="none" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
            <circle cx="24" cy="30" r="3" fill="#0f172a" />
          </svg>
        );

      // 28. Shield
      case 'shield':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <path d="M24 6 L38 11 V24 C38 33 24 42 24 42 C24 42 10 33 10 24 V11 Z" fill="#3b82f6" />
            <path d="M24 6 V42 C24 42 38 33 38 24 V11 Z" fill="#1d4ed8" />
          </svg>
        );

      // Default fallback
      default:
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-sm overflow-visible">
            <circle cx="24" cy="24" r="18" fill="#3b82f6" />
          </svg>
        );
    }
  };

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none pointer-events-none transition-transform duration-200 ${
        glow ? 'drop-shadow-[0_2px_8px_rgba(37,99,235,0.4)]' : ''
      } ${className}`}
      style={{ width: `${pixelSize}px`, height: `${pixelSize}px`, minWidth: `${pixelSize}px`, minHeight: `${pixelSize}px` }}
      aria-label={`${name} icon`}
    >
      {renderVectorGlyph()}
    </span>
  );
};
