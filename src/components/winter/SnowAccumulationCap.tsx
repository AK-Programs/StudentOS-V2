/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Organic Snow Accumulation Cap Component
 * - Renders realistic asymmetric curved snowdrifts resting on the upper edges of cards and controls.
 * - Uses React.useId() for collision-free SVG gradients across multiple simultaneous cards.
 * - Strictly non-intrusive (pointer-events: none, respects container border-radius).
 */

import React, { useId } from 'react';

export interface SnowAccumulationProps {
  className?: string;
  variant?: 'hero' | 'card' | 'badge' | 'button' | 'compact';
}

export const SnowAccumulationCap: React.FC<SnowAccumulationProps> = ({
  className = '',
  variant = 'card',
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `snowCapGrad_${variant}_${uid}`;
  const shadeGradId = `snowCapShade_${variant}_${uid}`;

  if (variant === 'button') {
    return (
      <span
        className={`pointer-events-none absolute -top-1 inset-x-2 h-2.5 overflow-hidden z-[2] ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 100 12"
          fill="none"
          preserveAspectRatio="none"
          className="w-full h-full drop-shadow-[0_1px_2px_rgba(15,23,42,0.35)]"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
              <stop offset="65%" stopColor="#e0f2fe" stopOpacity="0.82" />
              <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          <path
            d="M0,0 Q13,7 26,3 Q39,9.5 52,4 Q66,8.5 80,3.5 Q91,6.5 100,0 L100,0 L0,0 Z"
            fill={`url(#${gradId})`}
          />
          <path
            d="M0,0 Q13,7 26,3 Q39,9.5 52,4 Q66,8.5 80,3.5 Q91,6.5 100,0"
            stroke="#ffffff"
            strokeWidth="0.9"
            strokeOpacity="0.85"
          />
        </svg>
      </span>
    );
  }

  if (variant === 'hero') {
    return (
      <div
        className={`pointer-events-none absolute -top-1 inset-x-0 h-5 sm:h-6 overflow-hidden z-[3] ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 400 22"
          fill="none"
          preserveAspectRatio="none"
          className="w-full h-full drop-shadow-[0_2px_5px_rgba(15,23,42,0.42)]"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
              <stop offset="48%" stopColor="#e0f2fe" stopOpacity="0.88" />
              <stop offset="86%" stopColor="#bae6fd" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id={shadeGradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.28" />
              <stop offset="50%" stopColor="#e0f2fe" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* Cool subsurface shadow drift underneath */}
          <path
            d="M0,0 Q34,15 70,8 Q106,19 148,10 Q188,20 232,10 Q276,18 320,8 Q362,15 400,0 L400,0 L0,0 Z"
            fill={`url(#${shadeGradId})`}
          />
          {/* Primary asymmetric snow contour */}
          <path
            d="M0,0 Q30,12 66,6 Q102,16 142,7.5 Q184,18 224,8.5 Q268,16.5 312,6.5 Q356,13.5 400,0 L400,0 L0,0 Z"
            fill={`url(#${gradId})`}
          />
          {/* Crisp frosty top specular rim */}
          <path
            d="M0,0 Q30,12 66,6 Q102,16 142,7.5 Q184,18 224,8.5 Q268,16.5 312,6.5 Q356,13.5 400,0"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeOpacity="0.88"
          />
          {/* Micro frost glints */}
          <circle cx="142" cy="9.5" r="1.1" fill="#ffffff" opacity="0.9" />
          <circle cx="224" cy="10.5" r="1.3" fill="#ffffff" opacity="0.85" />
          <circle cx="312" cy="8.5" r="1.0" fill="#e0f2fe" opacity="0.75" />
        </svg>
      </div>
    );
  }

  const heightCls = variant === 'compact' ? 'h-3' : 'h-3.5 sm:h-4';
  return (
    <div
      className={`pointer-events-none absolute -top-1 inset-x-0 ${heightCls} overflow-hidden z-[2] ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 200 16"
        fill="none"
        preserveAspectRatio="none"
        className="w-full h-full drop-shadow-[0_1px_3px_rgba(15,23,42,0.35)]"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="58%" stopColor="#e0f2fe" stopOpacity="0.76" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path
          d="M0,0 Q20,8 46,4 Q72,12 102,5.5 Q132,11 162,4.5 Q182,8.5 200,0 L200,0 L0,0 Z"
          fill={`url(#${gradId})`}
        />
        <path
          d="M0,0 Q20,8 46,4 Q72,12 102,5.5 Q132,11 162,4.5 Q182,8.5 200,0"
          stroke="#ffffff"
          strokeWidth="1"
          strokeOpacity="0.82"
        />
        <circle cx="102" cy="7.5" r="1.05" fill="#ffffff" opacity="0.82" />
      </svg>
    </div>
  );
};
