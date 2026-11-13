/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure mathematical attendance analytics and projection helpers.
 * Projections are explicitly flagged as estimates for user planning clarity.
 */

export interface AttendanceStatusInput {
  status: string;
  date?: string;
  subject?: string;
}

export interface AttendanceSummaryStats {
  presentCount: number;
  lateCount: number;
  absentCount: number;
  leaveCount: number;
  holidayCount: number;
  totalConducted: number;
  effectivePresent: number;
  percentage: number;
}

export interface AttendanceProjectionResult {
  currentPercentage: number;
  targetPercentage: number;
  totalConducted: number;
  effectivePresent: number;
  classesNeededForTarget: number;
  canMissSafely: number;
  isMeetingTarget: boolean;
  isReachable: boolean;
  isEstimate: true;
  disclaimer: string;
}

export function computeAttendanceSummary(records: AttendanceStatusInput[]): AttendanceSummaryStats {
  const presentCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const leaveCount = records.filter(r => r.status === 'leave').length;
  const holidayCount = records.filter(r => r.status === 'holiday').length;

  const totalConducted = records.filter(r => r.status !== 'holiday').length;
  const effectivePresent = presentCount + lateCount;
  const percentage =
    totalConducted > 0
      ? Number(((effectivePresent / totalConducted) * 100).toFixed(1))
      : 100;

  return {
    presentCount,
    lateCount,
    absentCount,
    leaveCount,
    holidayCount,
    totalConducted,
    effectivePresent,
    percentage
  };
}

/**
 * Calculates how many consecutive attended sessions are needed to reach a target
 * threshold (or how many sessions could be missed while staying at/above target).
 * Always flagged as a planning estimate rather than an official policy guarantee.
 */
export function calculateAttendanceProjection(
  effectivePresent: number,
  totalConducted: number,
  targetPercent: number = 75
): AttendanceProjectionResult {
  const safePresent = Math.max(0, Math.floor(effectivePresent));
  const safeTotal = Math.max(0, Math.floor(totalConducted));
  const clampedTarget = Math.min(99, Math.max(1, Number(targetPercent) || 75));
  const targetRatio = clampedTarget / 100;

  const currentPercentage =
    safeTotal > 0 ? Number(((safePresent / safeTotal) * 100).toFixed(1)) : 100;

  const isMeetingTarget = currentPercentage >= clampedTarget;
  let classesNeededForTarget = 0;
  let canMissSafely = 0;
  const isReachable = clampedTarget < 100;

  if (safeTotal === 0) {
    classesNeededForTarget = 0;
    canMissSafely = 0;
  } else if (!isMeetingTarget) {
    // Solve (safePresent + x) / (safeTotal + x) >= targetRatio
    // x >= (targetRatio * safeTotal - safePresent) / (1 - targetRatio)
    const numerator = targetRatio * safeTotal - safePresent;
    const denominator = 1 - targetRatio;
    classesNeededForTarget = denominator > 0 ? Math.max(1, Math.ceil(numerator / denominator)) : 0;
  } else {
    // Solve safePresent / (safeTotal + m) >= targetRatio
    // m <= (safePresent / targetRatio) - safeTotal
    canMissSafely = Math.max(0, Math.floor(safePresent / targetRatio - safeTotal));
  }

  return {
    currentPercentage,
    targetPercentage: clampedTarget,
    totalConducted: safeTotal,
    effectivePresent: safePresent,
    classesNeededForTarget,
    canMissSafely,
    isMeetingTarget,
    isReachable,
    isEstimate: true,
    disclaimer:
      'Estimate based on recorded sessions and your selected target threshold. Official institutional leave rules may vary.'
  };
}
