/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared Single-Flight Santa 3D Model Cache & Idle Preloader
 * - Downloads /assets/models/santa.glb (609.1 KB) at most once into an in-memory ArrayBuffer promise.
 * - Preloads unobtrusively during browser idle time without instantiating any Three.js/WebGL scene.
 * - Exposes diagnostics for latency & deduplication verification.
 */

export const SANTA_MODEL_URL = '/assets/models/santa.glb';

export interface SantaPreloadMetrics {
  status: 'idle' | 'loading' | 'ready' | 'error';
  startedAtMs: number | null;
  completedAtMs: number | null;
  fetchDurationMs: number | null;
  byteLength: number | null;
  fetchCallsCount: number;
  lastError: string | null;
}

let cachedSantaGlbPromise: Promise<ArrayBuffer> | null = null;
let metrics: SantaPreloadMetrics = {
  status: 'idle',
  startedAtMs: null,
  completedAtMs: null,
  fetchDurationMs: null,
  byteLength: null,
  fetchCallsCount: 0,
  lastError: null,
};

export function fetchCachedSantaGlb(): Promise<ArrayBuffer> {
  if (!cachedSantaGlbPromise) {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    metrics = {
      ...metrics,
      status: 'loading',
      startedAtMs: start,
      fetchCallsCount: metrics.fetchCallsCount + 1,
      lastError: null,
    };

    cachedSantaGlbPromise = fetch(SANTA_MODEL_URL, { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load Santa 3D model (${res.status})`);
        }
        return res.arrayBuffer();
      })
      .then((buffer) => {
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        metrics = {
          ...metrics,
          status: 'ready',
          completedAtMs: end,
          fetchDurationMs: Math.round((end - start) * 100) / 100,
          byteLength: buffer.byteLength,
          lastError: null,
        };
        return buffer;
      })
      .catch((err) => {
        cachedSantaGlbPromise = null;
        metrics = {
          ...metrics,
          status: 'error',
          lastError: err?.message || 'Failed to preload Santa 3D model',
        };
        throw err;
      });
  }
  return cachedSantaGlbPromise;
}

export function scheduleSantaModelIdlePreload(): () => void {
  if (typeof window === 'undefined' || cachedSantaGlbPromise) {
    return () => {};
  }

  let cancelled = false;
  const trigger = () => {
    if (cancelled || cachedSantaGlbPromise) return;
    fetchCachedSantaGlb().catch(() => {
      // Non-fatal: Santa3DCanvas retries cleanly when modal opens
    });
  };

  const win = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (typeof win.requestIdleCallback === 'function') {
    const idleId = win.requestIdleCallback(trigger, { timeout: 2500 });
    return () => {
      cancelled = true;
      if (typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
    };
  }

  const timerId = window.setTimeout(trigger, 900);
  return () => {
    cancelled = true;
    window.clearTimeout(timerId);
  };
}

export function getSantaPreloadMetrics(): SantaPreloadMetrics {
  return { ...metrics };
}

export function resetSantaModelCacheForTests(): void {
  cachedSantaGlbPromise = null;
  metrics = {
    status: 'idle',
    startedAtMs: null,
    completedAtMs: null,
    fetchDurationMs: null,
    byteLength: null,
    fetchCallsCount: 0,
    lastError: null,
  };
}
