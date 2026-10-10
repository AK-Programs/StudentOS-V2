/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Panel Board Capability Detection & Registration Client
 * Inspects browser environment, pointer characteristics, display boundaries,
 * and manages secure classroom display token persistence.
 */

export interface PanelDetectionResult {
  isLikelyPanelBoard: boolean;
  confidenceScore: number; // 0 to 100
  screenWidth: number;
  screenHeight: number;
  touchPoints: number;
  hasTouch: boolean;
  isCoarsePointer: boolean;
  isFullscreenSupported: boolean;
  devicePixelRatio: number;
  displaySummary: string;
  reasons: string[];
}

export interface PanelBoardRegistrationData {
  id: string;
  school_id: string;
  class_id: string;
  section_id: string;
  display_name: string;
  registered_by: string;
  status: 'active' | 'revoked' | 'inactive';
  device_token: string;
  created_at: string;
  updated_at: string;
}

const PANEL_TOKEN_KEY = 'studentos_panel_device_token';
const PANEL_REGISTRATION_CACHE_KEY = 'studentos_panel_registration_cached';

/**
 * Perform non-intrusive heuristic detection of panel board display capabilities.
 * Important: Detection is a best-effort suggestion, not conclusive proof.
 */
export function detectPanelBoardCapabilities(): PanelDetectionResult {
  const screenWidth = typeof window !== 'undefined' ? window.screen?.width || window.innerWidth : 1920;
  const screenHeight = typeof window !== 'undefined' ? window.screen?.height || window.innerHeight : 1080;
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
  const hasTouch = typeof window !== 'undefined' ? 'ontouchstart' in window || touchPoints > 0 : false;
  
  let isCoarsePointer = false;
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    }
  } catch (_) {}

  const isFullscreenSupported = typeof document !== 'undefined'
    ? Boolean(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled)
    : false;

  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  let score = 0;
  const reasons: string[] = [];

  // Large display area (Smart boards / interactive flat panels are typically 1080p, 4K, or ultra-wide)
  if (screenWidth >= 1920 && screenHeight >= 1080) {
    score += 35;
    reasons.push('Full HD / 4K classroom display area detected');
  } else if (screenWidth >= 1366 && screenHeight >= 768) {
    score += 15;
    reasons.push('Wide presentation viewport detected');
  }

  // Multi-touch / Stylus support (Interactive panels feature 10 to 40 touch points)
  if (touchPoints >= 10) {
    score += 45;
    reasons.push(`High multi-touch interactive digitizer detected (${touchPoints} touch points)`);
  } else if (touchPoints >= 2) {
    score += 25;
    reasons.push(`Touchscreen capability detected (${touchPoints} touch points)`);
  }

  // Coarse pointer (finger or classroom stylus)
  if (isCoarsePointer) {
    score += 10;
    reasons.push('Primary pointer input calibrated for touch/stylus interaction');
  }

  // Fullscreen projection readiness
  if (isFullscreenSupported) {
    score += 10;
    reasons.push('Hardware fullscreen immersion supported');
  }

  const isLikelyPanelBoard = score >= 50;

  const displaySummary = isLikelyPanelBoard
    ? `Interactive Classroom Smart Display (${screenWidth}×${screenHeight}, ${touchPoints > 0 ? `${touchPoints}-point touch` : 'large canvas'})`
    : `Standard Display (${screenWidth}×${screenHeight}${touchPoints > 0 ? ', touchscreen' : ''})`;

  return {
    isLikelyPanelBoard,
    confidenceScore: Math.min(100, score),
    screenWidth,
    screenHeight,
    touchPoints,
    hasTouch,
    isCoarsePointer,
    isFullscreenSupported,
    devicePixelRatio,
    displaySummary,
    reasons
  };
}

/**
 * Check if the current device/browser has an active classroom registration in Supabase
 */
export async function checkPanelRegistration(): Promise<PanelBoardRegistrationData | null> {
  const token = localStorage.getItem(PANEL_TOKEN_KEY);
  if (!token) return null;

  try {
    const res = await fetch(`/api/panel-board/registration?token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.registration && data.registration.status === 'active') {
        localStorage.setItem(PANEL_REGISTRATION_CACHE_KEY, JSON.stringify(data.registration));
        return data.registration;
      }
    } else if (res.status === 404) {
      // Registration was revoked or missing
      localStorage.removeItem(PANEL_TOKEN_KEY);
      localStorage.removeItem(PANEL_REGISTRATION_CACHE_KEY);
      return null;
    }
  } catch (err) {
    console.warn('[PanelBoard] Backend verification offline, checking local cache:', err);
    try {
      const cached = localStorage.getItem(PANEL_REGISTRATION_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Store verified registration data locally
 */
export function storePanelRegistrationLocally(registration: PanelBoardRegistrationData): void {
  if (registration.device_token) {
    localStorage.setItem(PANEL_TOKEN_KEY, registration.device_token);
  }
  localStorage.setItem(PANEL_REGISTRATION_CACHE_KEY, JSON.stringify(registration));
}

/**
 * Clear local panel registration
 */
export function clearPanelRegistrationLocally(): void {
  localStorage.removeItem(PANEL_TOKEN_KEY);
  localStorage.removeItem(PANEL_REGISTRATION_CACHE_KEY);
}
