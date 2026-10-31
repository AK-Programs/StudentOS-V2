/**
 * VEYLENTRA — Centralized Branding Configuration
 * 
 * Central repository for all public-facing branding information.
 * Any future branding updates (name, descriptions, logo paths) should be made here.
 */

export interface BrandConfig {
  name: string;
  shortDescription: string;
  tagline: string;
  version: string;
  logo: {
    /**
     * Primary logo asset path.
     * To replace with your own logo, place your SVG file at `/public/brand/logo.svg`
     * or your transparent PNG at `/public/brand/logo.png`.
     */
    svgPath: string;
    pngPath: string;
    fallbackLetter: string;
    altText: string;
  };
}

export const BRAND_CONFIG: BrandConfig = {
  name: 'Veylentra',
  shortDescription: 'An integrated platform for modern school life and learning.',
  tagline: 'An integrated platform for modern school life and learning.',
  version: '3.12.0',
  logo: {
    svgPath: '/brand/logo.svg?v=20261031',
    pngPath: '/brand/logo.png?v=20261031',
    fallbackLetter: 'V',
    altText: 'Veylentra Logo'
  }
};
