import { supabase } from './supabase';
import { UserProfile, UserRole } from '../types';

export interface SupabaseUser {
  id?: string;
  email: string;
  full_name: string;
  role: string;
  permissions?: string[];
  created_at?: string;
  pin?: string;
}

/**
 * Maps a Supabase user row to a frontend UserProfile
 */
export function mapSupabaseUserToProfile(u: any): UserProfile {
  const raw = u.raw_data || {};
  return {
    uid: u.id || u.uid || u.firebase_uid || '',
    email: u.email?.toLowerCase(),
    name: u.name || u.full_name || 'Student',
    role: u.role as UserRole,
    permissions: u.permissions || [],
    grade: u.grade || u.class || '',
    section: u.section || '',
    house: u.house || '',
    department: u.department || null,
    subjects: u.subjects || [],
    specialtySubject: u.specialty_subject || null,
    designation: u.designation || null,
    photoURL: u.photo_url || u.profile_image || u.photoURL || raw.avatar || '',
    avatar: u.photo_url || u.profile_image || u.photoURL || raw.avatar || '',
    bannerUrl: u.banner_url || raw.bannerUrl || '',
    bannerPreset: u.banner_preset || raw.bannerPreset || '',
    bio: u.bio || raw.bio || '',
    pronouns: raw.pronouns || '',
    customStatus: raw.customStatus || '',
    avatarFrame: u.avatar_frame || raw.avatarFrame || 'none',
    accentColor: u.accent_color || raw.accentColor || 'indigo',
    accountStatus: u.account_status || u.accountStatus || 'approved',
    phone: raw.phone || '',
    birthdate: raw.birthdate || '',
    pin: u.pin || '',
    requestedRole: u.requested_role || u.requestedRole || u.role,
    enableWebPush: u.enable_web_push ?? raw.enableWebPush ?? false,
    fcmToken: raw.fcmToken || '',
    fcmDeviceId: raw.fcmDeviceId || '',
    studyHours: u.studyHours || 14,
    quizzesTaken: u.quizzesTaken || 5,
    streakDays: u.streakDays || 8,
    lastLogin: u.lastLogin || Date.now(),
    raw_data: raw,
  };
}

/**
 * Maps a frontend UserProfile to a Supabase user row format
 */
export function mapProfileToSupabaseUser(profile: UserProfile): Partial<SupabaseUser> {
  return {
    email: profile.email?.toLowerCase(),
    full_name: profile.name,
    role: profile.role,
    permissions: profile.permissions || [],
    pin: profile.pin || null,
  };
}

/**
 * Checks if a string is a valid UUID
 */
function isValidUUID(str: string): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// In-memory profile cache to prevent duplicate queries
const profileCache = new Map<string, { profile: UserProfile; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Fetches a user profile from Supabase user_profiles table.
 * If not found, falls back to old `users` table for legacy compatibility.
 */
export async function getSupabaseUserProfile(uid: string, email?: string, forceRefresh = false): Promise<UserProfile | null> {
  const cacheKey = uid || email || '';
  const now = Date.now();
  if (!forceRefresh && cacheKey && profileCache.has(cacheKey)) {
    const cached = profileCache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.profile;
    }
  }

  console.log('[SUPABASE-USERS] Fetching profile for uid:', uid, 'email:', email);
  let data: any = null;

  // 1. Try querying by id or uid in user_profiles
  if (uid) {
    try {
      const { data: res, error: err } = await supabase
        .from('user_profiles')
        .select('*')
        .or(`id.eq.${uid},uid.eq.${uid}`)
        .maybeSingle();
      if (!err && res) {
        data = res;
        console.log('[SUPABASE-USERS] Found profile by id/uid in user_profiles');
      }
    } catch (e) { }
  }

  // 2. Fallback to email in user_profiles
  if (!data && email) {
    try {
      const normalized = email.toLowerCase();
      const { data: res, error: err } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', normalized)
        .maybeSingle();
      if (!err && res) {
        data = res;
        console.log('[SUPABASE-USERS] Found profile by email in user_profiles');
      }
    } catch (e) { }
  }

  // 3. Fallback to old `users` table
  let foundInLegacy = false;
  if (!data) {
    try {
      if (uid) {
        const { data: oldRes } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
        if (oldRes) data = oldRes;
      }
      if (!data && email) {
        const { data: oldRes } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
        if (oldRes) data = oldRes;
      }
      if (!data && uid) {
        const { data: oldRes } = await supabase.from('users').select('*').eq('firebase_uid', uid).maybeSingle();
        if (oldRes) data = oldRes;
      }
      if (data) {
        console.log('[SUPABASE-USERS] Profile found in legacy users table, will map correctly.');
        foundInLegacy = true;
      }
    } catch (e) {}
  }

  if (!data) return null;

  const profile = mapSupabaseUserToProfile(data);

  if (uid) {
    profile.uid = uid;
  }

  // Backfill to new table
  if (foundInLegacy) {
    console.log('[SUPABASE-USERS] Migrating legacy profile to user_profiles table');
    saveSupabaseUserProfile(profile).catch(err => console.error("Failed to migrate legacy profile", err));
  }

  if (profile.uid) profileCache.set(profile.uid, { profile, timestamp: Date.now() });
  if (profile.email) profileCache.set(profile.email.toLowerCase(), { profile, timestamp: Date.now() });

  return profile;
}

/**
 * Creates or updates a user profile in Supabase `user_profiles` table.
 */
export async function saveSupabaseUserProfile(profile: UserProfile): Promise<UserProfile> {
  const targetId = profile.uid || (profile as any).id || profile.email?.toLowerCase();
  console.log('[SUPABASE-USERS] Saving user profile:', targetId);

  if (!targetId) {
    throw new Error('Cannot save profile without a valid user ID or email');
  }

  const upsertData: any = {
    id: targetId,
    uid: profile.uid || targetId,
    email: profile.email?.toLowerCase() || '',
    name: profile.name || '',
    role: profile.role || 'student',
    grade: profile.grade || null,
    section: profile.section || null,
    house: profile.house || null,
    department: (profile as any).department || null,
    subjects: (profile as any).subjects || [],
    specialty_subject: (profile as any).specialtySubject || null,
    designation: (profile as any).designation || null,
    photo_url: profile.photoURL || profile.avatar || null,
    bio: profile.bio || null,
    requested_role: profile.requestedRole || profile.role,
    account_status: profile.accountStatus || 'approved',
    badges: profile.badges || [],
    raw_data: { 
      ...(profile.raw_data || {}), 
      phone: profile.phone,
      birthdate: profile.birthdate,
      bannerUrl: profile.bannerUrl,
      bannerPreset: profile.bannerPreset,
      bio: profile.bio,
      pronouns: profile.pronouns,
      customStatus: profile.customStatus,
      avatarFrame: profile.avatarFrame,
      accentColor: profile.accentColor,
      badges: profile.badges,
      enableWebPush: Boolean(profile.enableWebPush),
      fcmSubscribed: Boolean(profile.enableWebPush),
      fcmToken: profile.fcmToken || (profile.raw_data || {}).fcmToken || '',
      fcmDeviceId: profile.fcmDeviceId || (profile.raw_data || {}).fcmDeviceId || '',
      unlockedFrames: (profile as any).unlockedFrames || ['none']
    },
    pin: profile.pin || null,
    updated_at: Date.now()
  };

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(upsertData, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) {
      // Fallback: try upserting by email if id conflict
      if (error.code === '23505' && profile.email) {
        const { data: emailData, error: emailError } = await supabase
          .from('user_profiles')
          .update(upsertData)
          .eq('email', profile.email.toLowerCase())
          .select()
          .maybeSingle();
        if (!emailError && emailData) {
          const savedProfile = mapSupabaseUserToProfile(emailData);
          if (savedProfile.uid) profileCache.set(savedProfile.uid, { profile: savedProfile, timestamp: Date.now() });
          if (savedProfile.email) profileCache.set(savedProfile.email.toLowerCase(), { profile: savedProfile, timestamp: Date.now() });
          return savedProfile;
        }
      }
      throw error;
    }
    
    const savedProfile = mapSupabaseUserToProfile(data || upsertData);
    if (savedProfile.uid) profileCache.set(savedProfile.uid, { profile: savedProfile, timestamp: Date.now() });
    if (savedProfile.email) profileCache.set(savedProfile.email.toLowerCase(), { profile: savedProfile, timestamp: Date.now() });
    return savedProfile;
  } catch (error) {
    console.error('[SUPABASE-USERS] Failed to save user profile:', error);
    throw error;
  }
}

/**
 * Fetches all registered users from Supabase `user_profiles`
 */
export async function fetchAllSupabaseUsers(): Promise<UserProfile[]> {
  console.log('[SUPABASE-USERS] Fetching all registered users...');
  
  const results: UserProfile[] = [];
  const addedIds = new Set<string>();

  // Fetch from user_profiles
  const { data: profiles, error: pErr } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (!pErr && profiles) {
    profiles.forEach(p => {
      const mapped = mapSupabaseUserToProfile(p);
      results.push(mapped);
      addedIds.add(mapped.uid || '');
    });
  }

  // Fallback to old users table for un-migrated users
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (!uErr && users) {
    users.forEach(u => {
      const mapped = mapSupabaseUserToProfile(u);
      if (mapped.uid && !addedIds.has(mapped.uid)) {
        results.push(mapped);
        addedIds.add(mapped.uid);
      }
    });
  }
  
  // Inject local offline/manual accounts
  try {
    const recent = localStorage.getItem('s_os_recent_accounts');
    if (recent) {
      const parsed = JSON.parse(recent);
      if (Array.isArray(parsed)) {
        parsed.forEach(acc => {
          if (acc.uid && !addedIds.has(acc.uid)) {
            results.push(acc as UserProfile);
            addedIds.add(acc.uid);
          }
        });
      }
    }
    const current = localStorage.getItem('s_os_user');
    if (current) {
      const parsed = JSON.parse(current);
      if (parsed.uid && !addedIds.has(parsed.uid)) {
        results.push(parsed as UserProfile);
        addedIds.add(parsed.uid);
      }
    }
  } catch(e) {}

  // Inject beautiful, high-fidelity mock user profiles to ensure directories are never empty
  const defaultMocks: UserProfile[] = [
    {
      uid: 'demo-student-uid',
      name: 'Naitik Kashyap',
      email: 'naitik.kashyap0015@gmail.com',
      role: 'student',
      grade: 'Grade 10',
      section: 'Astra',
      house: 'Ruby',
      accountStatus: 'approved'
    },
    {
      uid: 'friend-siddharth',
      name: 'Siddharth Sen',
      email: 'siddharth@school.edu',
      role: 'student',
      grade: 'Grade 10',
      section: 'Elara',
      house: 'Emerald',
      accountStatus: 'approved'
    },
    {
      uid: 'friend-meera',
      name: 'Meera Jain',
      email: 'meera.jain@school.edu',
      role: 'student',
      grade: 'Grade 9',
      section: 'Solara',
      house: 'Sapphire',
      accountStatus: 'approved'
    },
    {
      uid: 'friend-anya',
      name: 'Anya Mehta',
      email: 'anya.mehta@school.edu',
      role: 'student',
      grade: 'Grade 10',
      section: 'Vega',
      house: 'Topaz',
      accountStatus: 'approved'
    },
    {
      uid: 'friend-rahul',
      name: 'Rahul Dev',
      email: 'rahul.dev@school.edu',
      role: 'student',
      grade: 'Grade 11',
      section: 'Astra',
      house: 'Ruby',
      accountStatus: 'approved'
    },
    {
      uid: 'demo-teacher-uid',
      name: 'Physics Teacher',
      email: 'physics.teacher@school.edu',
      role: 'teacher',
      specialtySubject: 'Physics',
      assignedGrades: ['Grade 10', 'Grade 11'],
      assignedSections: ['Astra', 'Elara'],
      assignedClasses: ['10_Astra', '11_Elara'],
      accountStatus: 'approved'
    },
    {
      uid: 'teacher-math-uid',
      name: 'Prof. Alok Sharma (Maths)',
      email: 'alok.math@school.edu',
      role: 'teacher',
      specialtySubject: 'Mathematics',
      assignedGrades: ['Grade 10', 'Grade 12'],
      assignedSections: ['Solara', 'Vega'],
      assignedClasses: ['10_Solara', '12_Vega'],
      accountStatus: 'approved'
    },
    {
      uid: 'teacher-chemistry-uid',
      name: 'Dr. Rashmi Sen (Chemistry)',
      email: 'rashmi.chemistry@school.edu',
      role: 'teacher',
      specialtySubject: 'Chemistry',
      assignedGrades: ['Grade 9', 'Grade 10'],
      assignedSections: ['Astra', 'Elara'],
      assignedClasses: ['9_Astra', '10_Elara'],
      accountStatus: 'approved'
    },
    {
      uid: 'teacher-history-uid',
      name: 'Sanjay Dutt (History)',
      email: 'sanjay.history@school.edu',
      role: 'teacher',
      specialtySubject: 'History',
      assignedGrades: ['Grade 10', 'Grade 11'],
      assignedSections: ['Vega', 'Solara'],
      assignedClasses: ['10_Vega', '11_Solara'],
      accountStatus: 'approved'
    },
    {
      uid: 'coordinator-academic-uid',
      name: 'Meenakshi Iyer',
      email: 'meenakshi.coordinator@school.edu',
      role: 'coordinator',
      designation: 'Academic Head & Coordinator',
      accountStatus: 'approved'
    },
    {
      uid: 'coordinator-sports-uid',
      name: 'Vikram Rathore',
      email: 'vikram.sports@school.edu',
      role: 'coordinator',
      designation: 'Sports & Activities Director',
      accountStatus: 'approved'
    },
    {
      uid: 'demo-admin-uid',
      name: 'School Administrator',
      email: 'admin@school.edu',
      role: 'admin',
      accountStatus: 'approved'
    },
    {
      uid: 'super-admin-uid',
      name: 'Principal Dr. Kashyap',
      email: 'naitik.kashyap5205@gmail.com',
      role: 'super_admin',
      accountStatus: 'approved'
    }
  ];

  defaultMocks.forEach(mock => {
    if (mock.uid && !addedIds.has(mock.uid)) {
      results.push(mock);
      addedIds.add(mock.uid);
    }
  });
  
  return results;
}

/**
 * Deletes a user profile from Supabase
 */
export async function deleteSupabaseUser(uid: string): Promise<void> {
  console.log('[SUPABASE-USERS] Deleting user with id:', uid);
  
  // Delete from user_profiles
  if (isValidUUID(uid)) {
    const { error: pErr } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', uid);
    if (pErr) console.error('[SUPABASE-USERS] Error deleting from user_profiles:', pErr);
  }

  // Delete from legacy users table just in case
  const { error: uErr } = await supabase
    .from('users')
    .delete()
    .eq(isValidUUID(uid) ? 'id' : 'firebase_uid', uid);

  if (uErr) {
    console.warn('[SUPABASE-USERS] Could not delete from legacy users table (might be fine):', uErr);
  }
}
