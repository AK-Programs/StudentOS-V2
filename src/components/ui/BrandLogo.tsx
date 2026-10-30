import React, { useState } from 'react';
import { Sparkles, GraduationCap } from 'lucide-react';
import { BRAND_CONFIG } from '../../config/branding';

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  textClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  collapsed?: boolean;
}

/**
 * Reusable, Centralized Brand Logo Component for Veylentra.
 * 
 * Attempts to render the custom logo image asset from `/logo.svg` or `/logo.png`.
 * If the logo image file is not found or not yet uploaded by the user,
 * it smoothly falls back to a sleek vector emblem with the Veylentra brand name.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  imageClassName = '',
  showText = true,
  textClassName = '',
  size = 'md',
  collapsed = false
}) => {
  const [imgSrc, setImgSrc] = useState(BRAND_CONFIG.logo.pngPath);
  const [imageError, setImageError] = useState(false);

  // Size mappings
  const sizeMap = {
    sm: { container: 'h-6', img: 'h-6 w-auto', icon: 'w-4 h-4', text: 'text-sm' },
    md: { container: 'h-8', img: 'h-8 w-auto', icon: 'w-5 h-5', text: 'text-base font-bold' },
    lg: { container: 'h-10', img: 'h-10 w-auto', icon: 'w-6 h-6', text: 'text-lg font-black' },
    xl: { container: 'h-14', img: 'h-14 w-auto', icon: 'w-8 h-8', text: 'text-2xl font-black' }
  };

  const dimensions = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${dimensions.container} ${className}`}>
      {!imageError ? (
        <img
          src={imgSrc}
          alt={BRAND_CONFIG.name}
          className={`${dimensions.img} object-contain transition-all duration-300 ${imageClassName}`}
          onError={() => {
            if (imgSrc === BRAND_CONFIG.logo.pngPath) {
              setImgSrc(BRAND_CONFIG.logo.svgPath);
            } else {
              setImageError(true);
            }
          }}
        />
      ) : (
        <div className="relative flex items-center justify-center shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 border border-white/20">
            <GraduationCap className={dimensions.icon} />
          </div>
          <Sparkles className="w-3 h-3 text-cyan-300 absolute -top-1 -right-1 animate-pulse" />
        </div>
      )}

      {showText && !collapsed && (
        <span className={`font-display tracking-tight text-white ${dimensions.text} ${textClassName}`}>
          {BRAND_CONFIG.name}
        </span>
      )}
    </div>
  );
};

export default BrandLogo;
