/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Enterprise School & Multi-Tenancy Engine
 * Manages school entities, school switcher for Super Admins, and
 * per-school module feature flags with enterprise audit trail.
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

const DEFAULT_SCHOOLS: SchoolEntity[] = [
  {
    id: 'dps-main',
    name: 'Delhi Public School (Main Campus)',
    code: 'DPS-DEL-01',
    city: 'New Delhi',
    studentCount: 1420,
    teacherCount: 86,
    status: 'active'
  },
  {
    id: 'dps-intl',
    name: 'DPS International Academy',
    code: 'DPS-INT-02',
    city: 'Gurugram',
    studentCount: 980,
    teacherCount: 64,
    status: 'active'
  },
  {
    id: 'dps-north',
    name: 'DPS North Valley Campus',
    code: 'DPS-NTH-03',
    city: 'Chandigarh',
    studentCount: 750,
    teacherCount: 52,
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

const SCHOOLS_STORAGE_KEY = 'studentos_schools';
const ACTIVE_SCHOOL_KEY = 'studentos_active_school_id';
const FLAGS_STORAGE_KEY_PREFIX = 'studentos_flags_';

export function getSchools(): SchoolEntity[] {
  if (typeof window === 'undefined') return DEFAULT_SCHOOLS;
  try {
    const raw = localStorage.getItem(SCHOOLS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return DEFAULT_SCHOOLS;
}

export function getActiveSchoolId(): string {
  if (typeof window === 'undefined') return 'dps-main';
  try {
    const saved = localStorage.getItem(ACTIVE_SCHOOL_KEY);
    if (saved) return saved;
  } catch (_) {}
  return 'dps-main';
}

export function setActiveSchoolId(schoolId: string, actor: UserProfile): void {
  try {
    localStorage.setItem(ACTIVE_SCHOOL_KEY, schoolId);
    const schools = getSchools();
    const target = schools.find(s => s.id === schoolId);
    logAuditAction({
      actor,
      action: 'feature_flag_toggle',
      details: `Super Admin switched active institutional view to "${target?.name || schoolId}" (${schoolId})`,
      schoolId
    });
  } catch (_) {}
}

export function getSchoolFeatureFlags(schoolId: string): SchoolFeatureFlags {
  if (typeof window === 'undefined') return DEFAULT_FEATURE_FLAGS;
  try {
    const raw = localStorage.getItem(`${FLAGS_STORAGE_KEY_PREFIX}${schoolId}`);
    if (raw) return { ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_FEATURE_FLAGS };
}

export function setSchoolFeatureFlag(
  schoolId: string,
  flagKey: keyof SchoolFeatureFlags,
  enabled: boolean,
  actor: UserProfile
): SchoolFeatureFlags {
  const current = getSchoolFeatureFlags(schoolId);
  const updated = {
    ...current,
    [flagKey]: enabled
  };
  try {
    localStorage.setItem(`${FLAGS_STORAGE_KEY_PREFIX}${schoolId}`, JSON.stringify(updated));
    const schools = getSchools();
    const school = schools.find(s => s.id === schoolId);
    logAuditAction({
      actor,
      action: 'feature_flag_toggle',
      details: `Super Admin toggled module "${flagKey}" to ${enabled ? 'ENABLED' : 'DISABLED'} for school "${school?.name || schoolId}"`,
      schoolId,
      metadata: { flagKey, enabled }
    });
  } catch (_) {}
  return updated;
}
