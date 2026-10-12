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

function getLocalProfileKey(uidOrEmail: string): string {
  return `s_os_profile_store_${(uidOrEmail || '').toLowerCase()}`;
}

export function getDefaultProfileForAccount(uid?: string, email?: string): UserProfile | null {
  const key = (uid || email || '').toLowerCase();
  if (key === 'demo-student-uid' || key === 'student@demo.com' || key === 'aarav.sharma@studentos.edu') {
    return {
      uid: 'demo-student-uid',
      name: 'Aarav Sharma',
      email: 'student@demo.com',
      role: 'student',
      grade: 'Grade 10',
      section: 'Astra',
      house: 'Ruby',
      bio: 'Grade 10 Physics & Computer Science enthusiast. Building robotics & mastering competitive algorithms.',
      customStatus: 'Studying Rotational Mechanics ⚛️',
      studyHours: 18,
      quizzesTaken: 7,
      streakDays: 9,
      accountStatus: 'approved',
      raw_data: {
        savedMaterialIds: ['mat-teacher-1', 'mat-student-1'],
        tasks: [
          { id: 'task-stu-1', title: 'Complete AP Physics Rotational Torque problem set', completed: false, category: 'Physics', dueDate: 'Tomorrow', subject: 'Physics' },
          { id: 'task-stu-2', title: 'Implement AVL Tree rotations in C++', completed: true, category: 'Computer Science', dueDate: 'Friday', subject: 'Computer Science' },
          { id: 'task-stu-3', title: 'Review Organic Chemistry Reaction Mechanisms', completed: false, category: 'Chemistry', dueDate: 'Next Monday', subject: 'Chemistry' }
        ],
        schedules: [
          { id: 'sch-stu-1', day: 'Monday', time: '08:30 AM - 09:30 AM', subject: 'AP Physics', room: 'Lab 204' },
          { id: 'sch-stu-2', day: 'Tuesday', time: '10:00 AM - 11:00 AM', subject: 'Computer Science', room: 'CS Studio 1' },
          { id: 'sch-stu-3', day: 'Wednesday', time: '11:30 AM - 12:30 PM', subject: 'Calculus', room: 'Room 108' }
        ]
      }
    };
  }
  if (key === 'demo-teacher-uid' || key === 'teacher@demo.com' || key === 'physics.teacher@school.edu') {
    return {
      uid: 'demo-teacher-uid',
      name: 'Prof. Elara Vance',
      email: 'teacher@demo.com',
      role: 'teacher',
      department: 'Science & Engineering',
      specialtySubject: 'Physics',
      subjects: ['Physics', 'Mathematics'],
      designation: 'Senior Physics Faculty',
      house: 'Sapphire',
      bio: 'Senior AP Physics & Applied Mechanics Educator. Guiding Grade 10 & 11 scholars through rigorous inquiry.',
      customStatus: 'Grading Lab Reports & Office Hours 🔬',
      studyHours: 42,
      quizzesTaken: 15,
      streakDays: 21,
      accountStatus: 'approved',
      raw_data: {
        savedMaterialIds: ['mat-teacher-1', 'mat-teacher-2'],
        tasks: [
          { id: 'task-tea-1', title: 'Publish Grade 10 Rotational Dynamics Lab Rubric', completed: true, category: 'Physics', dueDate: 'Today', subject: 'Physics' },
          { id: 'task-tea-2', title: 'Grade Section A & B Kinematics Quizzes (28 submissions)', completed: false, category: 'Physics', dueDate: 'Tomorrow', subject: 'Physics' },
          { id: 'task-tea-3', title: 'Prepare Inter-House Science Olympiad question bank', completed: false, category: 'Science', dueDate: 'Thursday', subject: 'Physics' }
        ],
        schedules: [
          { id: 'sch-tea-1', day: 'Monday', time: '08:30 AM - 09:30 AM', subject: 'Grade 10A AP Physics Lecture', room: 'Lab 204' },
          { id: 'sch-tea-2', day: 'Wednesday', time: '01:00 PM - 02:30 PM', subject: 'Grade 11B Electromagnetism Lab', room: 'Main Physics Lab' },
          { id: 'sch-tea-3', day: 'Friday', time: '03:00 PM - 04:00 PM', subject: 'Faculty STEM Curriculum Sync', room: 'Conference Hall B' }
        ]
      }
    };
  }
  if (key === 'demo-parent-uid' || key === 'parent@demo.com' || key === 'parent@school.edu') {
    return {
      uid: 'demo-parent-uid',
      name: 'Rajesh Kashyap',
      email: 'parent@demo.com',
      role: 'parent',
      house: 'Ruby',
      bio: 'Parent of Naitik Kashyap (Grade 10 - Ruby House). Active member of the Parent-Faculty Advisory Council.',
      customStatus: 'Reviewing Weekly Progress Report 🛡️',
      studyHours: 6,
      quizzesTaken: 2,
      streakDays: 4,
      accountStatus: 'approved',
      raw_data: {
        savedMaterialIds: ['mat-teacher-1'],
        tasks: [
          { id: 'task-par-1', title: 'Review Naitik\'s Q3 Physics & Calculus progress card', completed: true, category: 'General', dueDate: 'Today', subject: 'General' },
          { id: 'task-par-2', title: 'Confirm RSVP for Parent-Teacher Conference on Friday', completed: false, category: 'General', dueDate: 'Friday', subject: 'General' }
        ],
        schedules: [
          { id: 'sch-par-1', day: 'Friday', time: '04:00 PM - 05:00 PM', subject: 'Parent-Teacher Meeting with Prof. Elara', room: 'Room 102 / Online' }
        ]
      }
    };
  }
  if (key === 'demo-admin-uid' || key === 'admin@demo.com' || key === 'admin@school.edu') {
    return {
      uid: 'demo-admin-uid',
      name: 'Principal Arthur Vance',
      email: 'admin@demo.com',
      role: 'admin',
      designation: 'School Principal & Institutional Administrator',
      house: 'Emerald',
      bio: 'Overseeing academic excellence, faculty operations, and campus-wide digital transformation.',
      customStatus: 'Campus Operations & Academic Audit ⚡',
      studyHours: 30,
      quizzesTaken: 10,
      streakDays: 14,
      accountStatus: 'approved',
      raw_data: {
        savedMaterialIds: ['mat-admin-1', 'mat-teacher-1'],
        tasks: [
          { id: 'task-adm-1', title: 'Approve Q3 Institutional Examination Timetable', completed: true, category: 'General', dueDate: 'Today', subject: 'General' },
          { id: 'task-adm-2', title: 'Review pending faculty & student role verifications', completed: false, category: 'General', dueDate: 'Tomorrow', subject: 'General' },
          { id: 'task-adm-3', title: 'Finalize Annual Athletics & Robotics Symposium budget', completed: false, category: 'General', dueDate: 'Friday', subject: 'General' }
        ],
        schedules: [
          { id: 'sch-adm-1', day: 'Monday', time: '09:00 AM - 10:00 AM', subject: 'All-Department Heads Briefing', room: 'Principal Boardroom' },
          { id: 'sch-adm-2', day: 'Thursday', time: '02:00 PM - 03:30 PM', subject: 'Campus Safety & Infrastructure Audit', room: 'Admin Wing' }
        ]
      }
    };
  }
  if (key === 'demo-super' || key === 'demo-super-admin-uid' || key === 'naitik.kashyap0015@gmail.com' || key === 'superadmin@studentos.edu') {
    return {
      uid: 'demo-super',
      name: 'Naitik Kashyap',
      email: 'naitik.kashyap0015@gmail.com',
      role: 'super_admin',
      grade: 'Grade 10',
      section: 'Astra',
      house: 'Ruby',
      designation: 'Founder & Super Admin',
      bio: 'System Architect & Super Admin of StudentOS. Full clearance across AI engines, curriculum hubs, and institutional analytics.',
      customStatus: 'Building & Orchestrating StudentOS 👑',
      studyHours: 64,
      quizzesTaken: 24,
      streakDays: 30,
      accountStatus: 'approved',
      raw_data: {
        savedMaterialIds: ['mat-super-1', 'mat-teacher-1', 'mat-student-1'],
        tasks: [
          { id: 'task-sup-1', title: 'Audit Orion AI multi-model routing & telemetry', completed: true, category: 'Computer Science', dueDate: 'Today', subject: 'Computer Science' },
          { id: 'task-sup-2', title: 'Complete AP Physics Mechanics & Calculus problem sets', completed: false, category: 'Physics', dueDate: 'Tomorrow', subject: 'Physics' },
          { id: 'task-sup-3', title: 'Review House Cup leaderboard standings & award badges', completed: false, category: 'General', dueDate: 'Friday', subject: 'General' }
        ],
        schedules: [
          { id: 'sch-sup-1', day: 'Monday', time: '08:30 AM - 09:30 AM', subject: 'AP Physics Mechanics', room: 'Lab 204' },
          { id: 'sch-sup-2', day: 'Tuesday', time: '11:00 AM - 12:00 PM', subject: 'Advanced Data Structures & AI', room: 'Innovation Lab' },
          { id: 'sch-sup-3', day: 'Thursday', time: '03:30 PM - 04:30 PM', subject: 'StudentOS Architecture Sync', room: 'Command Center' }
        ]
      }
    };
  }
  return null;
}

function getLocalSavedProfile(uid?: string, email?: string): UserProfile | null {
  try {
    if (uid) {
      const raw = localStorage.getItem(getLocalProfileKey(uid));
      if (raw) return JSON.parse(raw);
    }
    if (email) {
      const raw = localStorage.getItem(getLocalProfileKey(email));
      if (raw) return JSON.parse(raw);
    }
  } catch (_) {}
  return getDefaultProfileForAccount(uid, email);
}

export function saveLocalProfileBackup(profile: UserProfile): void {
  try {
    if (profile.uid) {
      localStorage.setItem(getLocalProfileKey(profile.uid), JSON.stringify(profile));
    }
    if (profile.email) {
      localStorage.setItem(getLocalProfileKey(profile.email), JSON.stringify(profile));
    }
  } catch (_) {}
}

/**
 * Fetches a user profile from Supabase user_profiles table.
 * If not found, falls back to old `users` table or local account store.
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
  const localFallback = getLocalSavedProfile(uid, email);
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

  if (!data) {
    if (localFallback) {
      saveLocalProfileBackup(localFallback);
      if (localFallback.uid) profileCache.set(localFallback.uid, { profile: localFallback, timestamp: Date.now() });
      if (localFallback.email) profileCache.set(localFallback.email.toLowerCase(), { profile: localFallback, timestamp: Date.now() });
      return localFallback;
    }
    return null;
  }

  const profile = mapSupabaseUserToProfile(data);

  if (uid) {
    profile.uid = uid;
  }

  // Merge rich default/local raw_data if remote raw_data is missing tasks/schedules
  if (localFallback) {
    profile.raw_data = {
      ...(localFallback.raw_data || {}),
      ...(profile.raw_data || {}),
      tasks: profile.raw_data?.tasks?.length ? profile.raw_data.tasks : (localFallback.raw_data?.tasks || []),
      schedules: profile.raw_data?.schedules?.length ? profile.raw_data.schedules : (localFallback.raw_data?.schedules || []),
      savedMaterialIds: profile.raw_data?.savedMaterialIds?.length ? profile.raw_data.savedMaterialIds : (localFallback.raw_data?.savedMaterialIds || [])
    };
  }

  // Backfill to new table
  if (foundInLegacy) {
    console.log('[SUPABASE-USERS] Migrating legacy profile to user_profiles table');
    saveSupabaseUserProfile(profile).catch(err => console.error("Failed to migrate legacy profile", err));
  }

  saveLocalProfileBackup(profile);
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
    saveLocalProfileBackup(savedProfile);
    if (savedProfile.uid) profileCache.set(savedProfile.uid, { profile: savedProfile, timestamp: Date.now() });
    if (savedProfile.email) profileCache.set(savedProfile.email.toLowerCase(), { profile: savedProfile, timestamp: Date.now() });
    return savedProfile;
  } catch (error) {
    console.warn('[SUPABASE-USERS] Supabase save notice, persisted to local profile backup:', error);
    const localSaved = mapSupabaseUserToProfile(upsertData);
    saveLocalProfileBackup(localSaved);
    if (localSaved.uid) profileCache.set(localSaved.uid, { profile: localSaved, timestamp: Date.now() });
    if (localSaved.email) profileCache.set(localSaved.email.toLowerCase(), { profile: localSaved, timestamp: Date.now() });
    return localSaved;
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
