/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Crisp, custom-crafted inline SVG Winter Festival artwork components.
 * Zero emojis, zero generic placeholders.
 */

import React from 'react';

export const SnowflakeVector: React.FC<{ className?: string; size?: number }> = ({
  className = 'text-sky-300',
  size = 20,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
    <path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5M4.5 9.5L7 12l-2.5 2.5M19.5 9.5L17 12l2.5 2.5" />
  </svg>
);

export const CandyCaneAccent: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 22,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M16 8.5a4 4 0 0 0-8 0V20"
      stroke="#f8fafc"
      strokeWidth="3.6"
      strokeLinecap="round"
    />
    <path
      d="M16 8.5a4 4 0 0 0-8 0V20"
      stroke="#dc2626"
      strokeWidth="3.6"
      strokeLinecap="round"
      strokeDasharray="3 3.2"
    />
  </svg>
);

export const WinterCookieSvg: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 22,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9.5" fill="#d97706" stroke="#fbbf24" strokeWidth="1.5" />
    <circle cx="8.5" cy="9" r="1.4" fill="#451a03" />
    <circle cx="15" cy="8.5" r="1.2" fill="#451a03" />
    <circle cx="13" cy="14" r="1.5" fill="#451a03" />
    <circle cx="8.5" cy="14.5" r="1.1" fill="#451a03" />
    <circle cx="16.2" cy="13.5" r="1" fill="#fef3c7" opacity="0.85" />
  </svg>
);

export const SantaGiftBoxSvg: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 28,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <rect x="4" y="13" width="24" height="15" rx="3" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.2" />
    <rect x="3" y="9" width="26" height="5" rx="2" fill="#b91c1c" stroke="#fecaca" strokeWidth="1.2" />
    <rect x="14" y="9" width="4" height="19" fill="#fbbf24" />
    <path d="M16 9c-2.8-4.5-7-4-7-1.2C9 10 13 9.5 16 9Z" fill="#fde047" />
    <path d="M16 9c2.8-4.5 7-4 7-1.2C23 10 19 9.5 16 9Z" fill="#facc15" />
  </svg>
);

export const FrostShieldSvg: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 22,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M12 2.5L4.5 5.8v5.9c0 5 3.2 8.7 7.5 9.8 4.3-1.1 7.5-4.8 7.5-9.8V5.8L12 2.5Z"
      fill="rgba(14, 165, 233, 0.2)"
      stroke="#38bdf8"
      strokeWidth="1.75"
    />
    <path
      d="M12 7v10M8.5 9l7 4M15.5 9l-7 4"
      stroke="#bae6fd"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

export const SnowCapAccent: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 120 14"
    fill="none"
    preserveAspectRatio="none"
    className={`w-full h-3 pointer-events-none ${className}`}
    aria-hidden="true"
  >
    <path
      d="M0 12C14 4 28 11 44 6C60 1 74 10 92 5C105 1 114 7 120 10V0H0V12Z"
      fill="rgba(224, 242, 254, 0.24)"
    />
  </svg>
);

export const SantaCharacterSvg: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 64,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    {/* Aura Halo */}
    <circle cx="32" cy="34" r="26" fill="rgba(244, 63, 94, 0.14)" stroke="rgba(251, 191, 36, 0.35)" strokeWidth="1.2" strokeDasharray="3 3" />
    {/* Shoulders / Coat */}
    <path d="M14 54c0-9.5 8-15 18-15s18 5.5 18 15" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.3" />
    {/* Coat White Trim */}
    <rect x="29" y="40" width="6" height="14" rx="2" fill="#f8fafc" />
    {/* Belt & Gold Buckle */}
    <rect x="16" y="48" width="32" height="4" rx="1.5" fill="#1e293b" />
    <rect x="28" y="47" width="8" height="6" rx="1.2" fill="#fbbf24" stroke="#78350f" strokeWidth="1" />
    {/* Face */}
    <circle cx="32" cy="28" r="10.5" fill="#fed7aa" />
    {/* Rosy Cheeks */}
    <circle cx="26.5" cy="29.5" r="1.8" fill="#fb7185" opacity="0.55" />
    <circle cx="37.5" cy="29.5" r="1.8" fill="#fb7185" opacity="0.55" />
    {/* Eyes */}
    <circle cx="28" cy="26" r="1.3" fill="#0f172a" />
    <circle cx="36" cy="26" r="1.3" fill="#0f172a" />
    {/* Fluffy Beard & Mustache */}
    <path d="M21.5 29c0 8.5 5 14 10.5 14s10.5-5.5 10.5-14c-2.5 2.5-5.5 3-10.5 3s-8-.5-10.5-3Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
    <path d="M26 30.5c2 1.8 4 1.5 6 0 2 1.5 4 1.8 6 0" stroke="#e2e8f0" strokeWidth="2.2" strokeLinecap="round" />
    {/* Nose */}
    <circle cx="32" cy="28.5" r="2" fill="#f43f5e" />
    {/* Santa Hat */}
    <path d="M21 21c2-9 9-14 17-12 4 1 7 4 8 8l-5 1c-2-3-5-4-8-3" fill="#dc2626" />
    <rect x="19.5" y="19" width="25" height="5" rx="2.5" fill="#f8fafc" />
    <circle cx="46" cy="18" r="3.2" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
  </svg>
);

