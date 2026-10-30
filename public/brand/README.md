# Veylentra Brand Assets

This directory contains the central brand assets for the Veylentra platform.

## How to Replace the Logo

You can easily replace the application logo without touching any source code:

1. **Vector SVG Logo (Recommended)**:
   - Place your SVG file at `public/brand/logo.svg`
   - Ensure it has a balanced `viewBox` (e.g. `0 0 100 100` or `0 0 120 120`).

2. **Raster PNG Logo (Alternative)**:
   - Place a square transparent PNG (recommended 512x512) at `public/brand/logo.png`.

3. **Fallback Behavior**:
   - The `<BrandLogo />` component automatically attempts to load `/brand/logo.svg`.
   - If missing or unable to load, it falls back to `/brand/logo.png`.
   - If neither is present, it renders a styled geometric "V" monogram with high-contrast gradient styling matching the current theme.

4. **Name & Tagline Customization**:
   - You can customize the brand name, description, and tagline centrally in:
     `src/config/branding.ts`
