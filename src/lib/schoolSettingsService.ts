/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Enterprise School Configuration
 * Manages the single-school configuration for United Public School.
 */

import { logAuditAction } from './auditLogService';
import { UserProfile } from '../types';

export interface SchoolEntity {
  id: string;
  name: string;
  code: string;
  city: string;
  studentCount: number;
  teacherCount: number;
  status: 'active' | 'trial' | 'archived';
}

export interface SchoolFeatureFlags {
  aiBuddy: boolean;
  peerChat: boolean;
  whiteboard: boolean;
  digitalGradebook: boolean;
  digitalReportCards: boolean;
  attendanceManager: boolean;
  materialsHub: boolean;
  scheduledReleases: boolean;
}

const UNITED_PUBLIC_SCHOOL_ID = 'united-public-school';

const DEFAULT_SCHOOLS: SchoolEntity[] = [
  {
    id: UNITED_PUBLIC_SCHOOL_ID,
    name: 'United Public School',
    code: 'UPS-MAIN-01',
    city: 'New Delhi',
    studentCount: 1420,
    teacherCount: 86,
    status: 'active'
  }
];

const DEFAULT_FEATURE_FLAGS: SchoolFeatureFlags = {
  aiBuddy: true,
  peerChat: true,
  whiteboard: true,
  digitalGradebook: true,
  digitalReportCards: true,
  attendanceManager: true,
  materialsHub: true,
  scheduledReleases: true
};

const FLAGS_STORAGE_KEY_PREFIX = 'veylentra_flags_';

export function getSchools(): SchoolEntity[] {
  return DEFAULT_SCHOOLS;
}

export function getActiveSchoolId(): string {
  return UNITED_PUBLIC_SCHOOL_ID;
}

// No-op for single school
export function setActiveSchoolId(schoolId: string, actor: UserProfile): void {
  // Always united-public-school
}

export function getSchoolFeatureFlags(schoolId: string = UNITED_PUBLIC_SCHOOL_ID): SchoolFeatureFlags {
  if (typeof window === 'undefined') return DEFAULT_FEATURE_FLAGS;
  try {
    const raw = localStorage.getItem(`${FLAGS_STORAGE_KEY_PREFIX}${UNITED_PUBLIC_SCHOOL_ID}`);
    if (raw) return { ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_FEATURE_FLAGS };
}

export function setSchoolFeatureFlag(
  schoolId: string = UNITED_PUBLIC_SCHOOL_ID,
  flagKey: keyof SchoolFeatureFlags,
  enabled: boolean,
  actor: UserProfile
): SchoolFeatureFlags {
  const current = getSchoolFeatureFlags(UNITED_PUBLIC_SCHOOL_ID);
  const updated = {
    ...current,
    [flagKey]: enabled
  };
  try {
    localStorage.setItem(`${FLAGS_STORAGE_KEY_PREFIX}${UNITED_PUBLIC_SCHOOL_ID}`, JSON.stringify(updated));
    logAuditAction({
      actor,
      action: 'feature_flag_toggle',
      details: `Super Admin toggled module "${flagKey}" to ${enabled ? 'ENABLED' : 'DISABLED'} for United Public School`,
      schoolId: UNITED_PUBLIC_SCHOOL_ID,
      metadata: { flagKey, enabled }
    });
  } catch (_) {}
  return updated;
}
