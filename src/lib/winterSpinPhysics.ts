/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mathematically controlled 8-second Winter Spin Wheel deceleration physics
 * and segment-boundary peg crossing detector.
 *
 * Curve properties for f(u) = 1 - (1 - u)^p with p = 2.4 over T = 8000ms:
 * - t = 0..5000ms (u = 0.625): ~90.0–90.5% of total rotation completed
 * - t = 5000..7000ms (u = 0.875): ~99.3% completed (gradual slow approach)
 * - t = 7000..8000ms (u = 0.875..1.0): < 0.8% remaining (~24.5 deg crawl to rest)
 * - Strictly monotonic increasing, C1-continuous across API resolution, zero overshoot.
 */

export const SPIN_TOTAL_DURATION_MS = 8000;
export const SPIN_REDUCED_MOTION_DURATION_MS = 750;
export const SPIN_DECEL_EXPONENT = 2.4;
export const SPIN_NOMINAL_EXTRA_TURNS = 10; // 3600 deg nominal travel

export function getSegmentCenterModulo(segmentIndex: number, segmentCount: number): number {
  const safeCount = Math.max(1, segmentCount);
  const sliceDeg = 360 / safeCount;
  const centerOfSlice = segmentIndex * sliceDeg + sliceDeg / 2;
  return ((360 - centerOfSlice) % 360 + 360) % 360;
}

/**
 * Monotonic ease-out deceleration curve: f(0)=0, f(1)=1, f'(1)=0.
 */
export function evaluateDecelCurve(progress: number, exponent: number = SPIN_DECEL_EXPONENT): number {
  const u = Math.max(0, Math.min(1, progress));
  return 1 - Math.pow(1 - u, Math.max(1.2, exponent));
}

/**
 * Derivative df/du of evaluateDecelCurve.
 */
export function evaluateDecelDerivative(progress: number, exponent: number = SPIN_DECEL_EXPONENT): number {
  const u = Math.max(0, Math.min(1, progress));
  const p = Math.max(1.2, exponent);
  if (u >= 1) return 0;
  return p * Math.pow(1 - u, p - 1);
}

function smoothstep01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

export interface SpinLaunchState {
  startAngle: number;
  nominalDelta: number;
  durationMs: number;
  exponent: number;
}

export interface SpinResolvedPlan {
  startAngle: number;
  nominalDelta: number;
  exponent: number;
  anchorAngle: number;
  targetAngle: number;
  deltaCorrection: number;
  resolvedAtMs: number;
  blendEndMs: number;
  endAtMs: number;
  reducedMotion: boolean;
}

/**
 * Evaluates angle and instantaneous angular velocity (deg/ms) during the
 * pre-API launch phase so the wheel moves immediately on user tap.
 */
export function evaluateLaunchPhase(launch: SpinLaunchState, elapsedMs: number): {
  angle: number;
  velocityDegPerMs: number;
} {
  const cruiseCapU = 0.25; // 2000ms cap before constant-speed cruise if network stalls
  const rawU = Math.max(0, elapsedMs / launch.durationMs);
  if (rawU <= cruiseCapU) {
    const angle = launch.startAngle + launch.nominalDelta * evaluateDecelCurve(rawU, launch.exponent);
    const velocityDegPerMs =
      (launch.nominalDelta / launch.durationMs) * evaluateDecelDerivative(rawU, launch.exponent);
    return { angle, velocityDegPerMs };
  }

  const angleAtCap = launch.startAngle + launch.nominalDelta * evaluateDecelCurve(cruiseCapU, launch.exponent);
  const velAtCap =
    (launch.nominalDelta / launch.durationMs) * evaluateDecelDerivative(cruiseCapU, launch.exponent);
  const extraMs = elapsedMs - cruiseCapU * launch.durationMs;
  return {
    angle: angleAtCap + velAtCap * extraMs,
    velocityDegPerMs: velAtCap,
  };
}

/**
 * Once the server returns the authoritative segmentIndex, computes a C1-continuous
 * global 8-second deceleration plan that blends the [0, 360) mod correction smoothly
 * in the first half of the spin, preserving the exact 0–5s / 5–7s / 7–8s deceleration profile.
 */
export function buildResolvedSpinPlan(params: {
  launch: SpinLaunchState;
  resolvedAtMs: number;
  segmentIndex: number;
  segmentCount: number;
  reducedMotion?: boolean;
}): SpinResolvedPlan {
  const { launch, resolvedAtMs, segmentIndex, segmentCount, reducedMotion = false } = params;
  const { angle: anchorAngle } = evaluateLaunchPhase(launch, resolvedAtMs);
  const desiredMod = getSegmentCenterModulo(segmentIndex, segmentCount);

  if (reducedMotion) {
    const currentMod = ((anchorAngle % 360) + 360) % 360;
    const modDelta = ((desiredMod - currentMod) % 360 + 360) % 360;
    const targetAngle = anchorAngle + 360 + modDelta;
    return {
      startAngle: launch.startAngle,
      nominalDelta: launch.nominalDelta,
      exponent: launch.exponent,
      anchorAngle,
      targetAngle,
      deltaCorrection: targetAngle - anchorAngle,
      resolvedAtMs,
      blendEndMs: resolvedAtMs + SPIN_REDUCED_MOTION_DURATION_MS,
      endAtMs: resolvedAtMs + SPIN_REDUCED_MOTION_DURATION_MS,
      reducedMotion: true,
    };
  }

  // Standard prompt path (resolvedAtMs <= 2000ms): keep exact 8000ms end time & global f(t/8000) curve
  if (resolvedAtMs <= 2000) {
    const nominalTarget = launch.startAngle + launch.nominalDelta;
    const nominalMod = ((nominalTarget % 360) + 360) % 360;
    const positiveCorrection = ((desiredMod - nominalMod) % 360 + 360) % 360; // strictly in [0, 360)
    const targetAngle = nominalTarget + positiveCorrection;
    const blendEndMs = Math.min(4500, resolvedAtMs + 2000);

    return {
      startAngle: launch.startAngle,
      nominalDelta: launch.nominalDelta,
      exponent: launch.exponent,
      anchorAngle,
      targetAngle,
      deltaCorrection: positiveCorrection,
      resolvedAtMs,
      blendEndMs,
      endAtMs: launch.durationMs,
      reducedMotion: false,
    };
  }

  // Latency > 2000ms: still guarantee wheel stops by exactly launch.durationMs (8000ms)
  const endAtMs = launch.durationMs;
  const currentMod = ((anchorAngle % 360) + 360) % 360;
  const modDelta = ((desiredMod - currentMod) % 360 + 360) % 360;
  const extraTurns = endAtMs - resolvedAtMs > 3000 ? 360 : 0;
  const remainingDelta = extraTurns + modDelta;
  return {
    startAngle: launch.startAngle,
    nominalDelta: launch.nominalDelta,
    exponent: launch.exponent,
    anchorAngle,
    targetAngle: anchorAngle + remainingDelta,
    deltaCorrection: remainingDelta,
    resolvedAtMs,
    blendEndMs: endAtMs,
    endAtMs,
    reducedMotion: false,
  };
}

/**
 * Evaluates wheel rotation angle (degrees) at `elapsedMs` given a resolved plan.
 */
export function evaluateResolvedSpinAngle(plan: SpinResolvedPlan, elapsedMs: number): {
  angle: number;
  progress: number;
  finished: boolean;
} {
  if (elapsedMs >= plan.endAtMs) {
    return { angle: plan.targetAngle, progress: 1, finished: true };
  }

  if (plan.reducedMotion || plan.resolvedAtMs > 2000) {
    const span = Math.max(1, plan.endAtMs - plan.resolvedAtMs);
    const u = Math.max(0, Math.min(1, (elapsedMs - plan.resolvedAtMs) / span));
    const eased = evaluateDecelCurve(u, plan.exponent);
    return {
      angle: plan.anchorAngle + plan.deltaCorrection * eased,
      progress: u,
      finished: false,
    };
  }

  const globalU = Math.max(0, Math.min(1, elapsedMs / plan.endAtMs));
  const baseAngle = plan.startAngle + plan.nominalDelta * evaluateDecelCurve(globalU, plan.exponent);
  const blendSpan = Math.max(1, plan.blendEndMs - plan.resolvedAtMs);
  const blendFrac = smoothstep01((elapsedMs - plan.resolvedAtMs) / blendSpan);

  return {
    angle: baseAngle + plan.deltaCorrection * blendFrac,
    progress: globalU,
    finished: false,
  };
}

/**
 * Detects exact segment-boundary peg crossings between `prevAngleDeg` and `nextAngleDeg`.
 * Segment boundaries are at 0, sliceDeg, 2*sliceDeg, ... clockwise from 12 o'clock.
 */
export function countPegBoundaryCrossings(
  prevAngleDeg: number,
  nextAngleDeg: number,
  segmentCount: number
): number {
  const safeCount = Math.max(1, segmentCount);
  const sliceDeg = 360 / safeCount;
  const prevIdx = Math.floor((prevAngleDeg + 1e-6) / sliceDeg);
  const nextIdx = Math.floor((nextAngleDeg + 1e-6) / sliceDeg);
  return Math.max(0, nextIdx - prevIdx);
}
