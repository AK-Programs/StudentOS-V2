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
