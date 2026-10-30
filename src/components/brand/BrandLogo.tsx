import React, { useState } from 'react';
import { BRAND_CONFIG } from '../../config/branding';

export interface BrandLogoProps {
  /** Size preset or pixel dimensions */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Additional CSS class names for the container */
  className?: string;
  /** Additional CSS class names for the image or icon */
  imageClassName?: string;
  /** Whether to render the brand name text alongside the emblem */
  withText?: boolean;
  /** Custom class for the brand name text */
  textClassName?: string;
  /** Custom subtitle or role tag beneath the brand name */
  subtitle?: string;
}

const SIZE_MAP = {
  xs: { box: 20, text: 'text-sm' },
  sm: { box: 28, text: 'text-base font-semibold' },
  md: { box: 36, text: 'text-lg font-bold' },
  lg: { box: 48, text: 'text-2xl font-black' },
  xl: { box: 64, text: 'text-3xl font-black' },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
  imageClassName = '',
  withText = false,
  textClassName = '',
  subtitle
}) => {
  const [loadStage, setLoadStage] = useState<'svg' | 'png' | 'fallback'>('svg');

  const dim = typeof size === 'number' ? size : SIZE_MAP[size]?.box ?? 36;
  const textSize = typeof size === 'number' ? 'text-lg font-bold' : SIZE_MAP[size]?.text ?? 'text-lg font-bold';

  const handleError = () => {
    if (loadStage === 'svg') {
      setLoadStage('png');
    } else if (loadStage === 'png') {
      setLoadStage('fallback');
    }
  };

  const renderEmblem = () => {
    if (loadStage === 'svg') {
      return (
        <img
          src={BRAND_CONFIG.logo.svgPath}
          alt={BRAND_CONFIG.logo.altText}
          width={dim}
          height={dim}
          onError={handleError}
          className={`object-contain transition-transform duration-200 ${imageClassName}`}
          style={{ width: `${dim}px`, height: `${dim}px` }}
        />
      );
    }

    if (loadStage === 'png') {
      return (
        <img
          src={BRAND_CONFIG.logo.pngPath}
          alt={BRAND_CONFIG.logo.altText}
          width={dim}
          height={dim}
          onError={handleError}
          className={`object-contain transition-transform duration-200 ${imageClassName}`}
          style={{ width: `${dim}px`, height: `${dim}px` }}
        />
      );
    }

    // Graceful SVG Monogram Fallback if both image files fail
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-800 text-white font-black shadow-md ${imageClassName}`}
        style={{ width: `${dim}px`, height: `${dim}px`, fontSize: `${Math.round(dim * 0.55)}px` }}
        aria-label={BRAND_CONFIG.name}
      >
        {BRAND_CONFIG.logo.fallbackLetter}
      </div>
    );
  };

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className="relative flex-shrink-0 flex items-center justify-center">
        {renderEmblem()}
      </div>

      {withText && (
        <div className="flex flex-col leading-none select-none">
          <span className={`tracking-tight ${textSize} ${textClassName || 'text-slate-900 dark:text-white'}`}>
            {BRAND_CONFIG.name}
          </span>
          {subtitle && (
            <span className="text-[10px] font-medium tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default BrandLogo;
