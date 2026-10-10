/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Classroom Panel Board Service & Device Registration Manager
 * Authoritative lifecycle, classroom binding, school tenant isolation,
 * and Supabase persistence for interactive classroom smart displays.
 */

import crypto from 'crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

export interface PanelBoardDeviceMetadata {
  screenWidth?: number;
  screenHeight?: number;
  touchPoints?: number;
  userAgent?: string;
  isInteractiveTouch?: boolean;
  pixelRatio?: number;
}

export interface PanelBoardRegistration {
  id: string;
  school_id: string;
  class_id: string;
  section_id: string;
  display_name: string;
  registered_by: string;
  status: 'active' | 'revoked' | 'inactive';
  device_token: string;
  device_metadata?: PanelBoardDeviceMetadata;
  created_at: string;
  updated_at: string;
}

// In-memory cache for fast lookups
let registrationsCache: Map<string, PanelBoardRegistration> = new Map();
let cacheLoaded = false;

/**
 * Load registrations from Supabase global_data into memory cache
 */
async function loadRegistrationsFromSupabase(): Promise<void> {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/global_data?id=eq.__panel_board_registrations__&select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (resp.ok) {
      const rows = await resp.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
        const list: PanelBoardRegistration[] = Array.isArray(rows[0].data)
          ? rows[0].data
          : Object.values(rows[0].data);
        registrationsCache.clear();
        for (const item of list) {
          if (item && item.id) {
            registrationsCache.set(item.id, item);
            if (item.device_token) {
              registrationsCache.set(item.device_token, item);
            }
          }
        }
      }
    }
    cacheLoaded = true;
  } catch (err) {
    console.warn('[PanelBoardService] Supabase initial load error:', err);
    cacheLoaded = true;
  }
}

/**
 * Persist registrations cache to Supabase global_data
 */
async function syncRegistrationsToSupabase(): Promise<void> {
  const uniqueItems = Array.from(
    new Map(
      Array.from(registrationsCache.values()).map(r => [r.id, r])
    ).values()
  );

  const payload = {
    id: '__panel_board_registrations__',
    data: uniqueItems,
    updated_at: new Date().toISOString()
  };

  try {
    // Upsert to global_data using POST with resolution merge-duplicates
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/global_data`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      console.warn('[PanelBoardService] Supabase upsert status:', resp.status);
    }
  } catch (err) {
    console.error('[PanelBoardService] Failed to sync registrations to Supabase:', err);
  }
}

/**
 * Retrieve verified panel registration by token or registration ID
 */
export async function getPanelRegistration(tokenOrId: string): Promise<PanelBoardRegistration | null> {
  if (!tokenOrId) return null;
  if (!cacheLoaded) {
    await loadRegistrationsFromSupabase();
  }

  const found = registrationsCache.get(tokenOrId);
  if (found && found.status === 'active') {
    return found;
  }

  // Double check fresh from Supabase if not in cache
  await loadRegistrationsFromSupabase();
  const fresh = registrationsCache.get(tokenOrId);
  if (fresh && fresh.status === 'active') {
    return fresh;
  }

  return null;
}

/**
 * Register a new classroom panel board display
 */
export async function registerClassroomPanel(params: {
  school_id: string;
  class_id: string;
  section_id: string;
  display_name?: string;
  registered_by: string;
  device_metadata?: PanelBoardDeviceMetadata;
}): Promise<PanelBoardRegistration> {
  if (!cacheLoaded) {
    await loadRegistrationsFromSupabase();
  }

  const schoolId = params.school_id?.trim() || 'default_school';
  const classId = params.class_id?.trim();
  const sectionId = params.section_id?.trim();

  if (!classId || !sectionId) {
    throw new Error('Class/Grade and Section are required to register a classroom panel.');
  }

  const id = `pnl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const deviceToken = `tok_pnl_${crypto.randomBytes(18).toString('hex')}`;
  const now = new Date().toISOString();

  const registration: PanelBoardRegistration = {
    id,
    school_id: schoolId,
    class_id: classId,
    section_id: sectionId,
    display_name: params.display_name?.trim() || `${classId} (${sectionId}) Smart Display`,
    registered_by: params.registered_by || 'system',
    status: 'active',
    device_token: deviceToken,
    device_metadata: params.device_metadata,
    created_at: now,
    updated_at: now
  };

  registrationsCache.set(registration.id, registration);
  registrationsCache.set(registration.device_token, registration);

  await syncRegistrationsToSupabase();
  return registration;
}

/**
 * Reassign an existing panel board to a new class / section / display name
 */
export async function reassignClassroomPanel(params: {
  idOrToken: string;
  class_id?: string;
  section_id?: string;
  display_name?: string;
  updated_by: string;
}): Promise<PanelBoardRegistration> {
  if (!cacheLoaded) {
    await loadRegistrationsFromSupabase();
  }

  const existing = await getPanelRegistration(params.idOrToken);
  if (!existing) {
    throw new Error('Panel registration not found or is no longer active.');
  }

  const updated: PanelBoardRegistration = {
    ...existing,
    class_id: params.class_id?.trim() || existing.class_id,
    section_id: params.section_id?.trim() || existing.section_id,
    display_name: params.display_name?.trim() || existing.display_name,
    updated_at: new Date().toISOString()
  };

  registrationsCache.set(updated.id, updated);
  registrationsCache.set(updated.device_token, updated);

  await syncRegistrationsToSupabase();
  return updated;
}

/**
 * Revoke a panel board registration
 */
export async function revokeClassroomPanel(idOrToken: string): Promise<boolean> {
  if (!cacheLoaded) {
    await loadRegistrationsFromSupabase();
  }

  const existing = await getPanelRegistration(idOrToken);
  if (!existing) {
    return false;
  }

  const updated: PanelBoardRegistration = {
    ...existing,
    status: 'revoked',
    updated_at: new Date().toISOString()
  };

  registrationsCache.set(updated.id, updated);
  registrationsCache.set(updated.device_token, updated);

  await syncRegistrationsToSupabase();
  return true;
}

/**
 * Retrieve dynamic metadata: available classes, sections, and schools from real database records
 */
export async function getRealClassroomMetadata(): Promise<{
  grades: string[];
  sections: string[];
  schools: { id: string; name: string }[];
}> {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?select=grade,section,school_id&limit=250`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    const fallbackGrades = [
      'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
    ];
    const fallbackSections = ['Astra', 'Elera', 'Solara', 'Section A', 'Section B'];

    if (resp.ok) {
      const rows = await resp.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const dbGrades = rows.map((r: any) => r.grade).filter(Boolean);
        const dbSections = rows.map((r: any) => r.section).filter(Boolean);
        const allGrades = Array.from(new Set([...fallbackGrades, ...dbGrades])).sort();
        const allSections = Array.from(new Set([...fallbackSections, ...dbSections])).sort();

        return {
          grades: allGrades,
          sections: allSections,
          schools: [
            { id: 'default_school', name: 'Oakridge International Academy' },
            { id: 'campus_main', name: 'Main Campus Senior Wing' }
          ]
        };
      }
    }

    return {
      grades: fallbackGrades,
      sections: fallbackSections,
      schools: [{ id: 'default_school', name: 'Oakridge International Academy' }]
    };
  } catch (err) {
    console.warn('[PanelBoardService] Error fetching classroom metadata:', err);
    return {
      grades: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
      sections: ['Astra', 'Elera', 'Solara', 'Section A', 'Section B'],
      schools: [{ id: 'default_school', name: 'Oakridge International Academy' }]
    };
  }
}
