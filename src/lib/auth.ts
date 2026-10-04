import { supabase } from './supabase';
import { getSupabaseUserProfile, saveSupabaseUserProfile } from './supabaseUsers';
import type { UserProfile } from '../types';

/**
 * Initialize Supabase auth listener and session handling.
 * Call initSupabaseAuthListener(setProfile) from your app's root (e.g. App component)
 * setProfile should accept a UserProfile | null and update your app state.
 */
export function initSupabaseAuthListener(setProfile: (p: UserProfile | null) => void) {
  // If URL contains OAuth response in the hash, explicitly parse it first so the SDK stores the session
  try {
    if (typeof window !== 'undefined' && window.location) {
      const hash = window.location.hash || '';
      const hasOAuthHash = hash.includes('access_token') || hash.includes('type=oauth') || hash.includes('refresh_token');
      if (hasOAuthHash) {
        console.log('[AUTH-LISTENER] OAuth hash found in URL — attempting to parse session from URL');
        // supabase.auth.getSessionFromUrl will parse the hash and store the session in browser storage
        try {
          // getSessionFromUrl is available in supabase-js v2
          (async () => {
            try {
              const res: any = await (supabase.auth as any).getSessionFromUrl();
              const session = res?.data?.session;
              const user = session?.user;
              if (user) {
                // Clean up the URL so the hash isn't re-parsed on reload
                try {
                  history.replaceState(null, '', window.location.pathname + window.location.search);
                } catch (e) {
                  /* ignore */
                }
                await handleSession(user, setProfile);
              }
            } catch (e) {
              console.warn('[AUTH-LISTENER] getSessionFromUrl failed:', e);
            }
          })();
        } catch (e) {
          console.warn('[AUTH-LISTENER] getSessionFromUrl not available on this SDK version:', e);
        }
      }
    }
  } catch (e) {
    console.warn('[AUTH-LISTENER] URL check failed:', e);
  }

  // Immediately check current session on load
  (async () => {
    try {
      const sessionRes: any = await supabase.auth.getSession();
      const session = sessionRes?.data?.session;
      const user = session?.user;
      if (user) {
        await handleSession(user, setProfile);
      }
    } catch (e) {
      console.warn('[AUTH-LISTENER] getSession failed:', e);
    }
  })();

  // Subscribe to auth state changes
  try {
    supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      const user = session?.user;
      console.log('[AUTH-LISTENER] onAuthStateChange event:', _event);
      if (user) {
        // If URL still contains an OAuth hash, clean it now (defensive)
        try {
          if (typeof window !== 'undefined' && window.location && window.location.hash) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        } catch (e) {}
        await handleSession(user, setProfile);
      } else {
        setProfile(null);
      }
    });
  } catch (e) {
    console.warn('[AUTH-LISTENER] onAuthStateChange subscription failed:', e);
  }
}

async function handleSession(user: any, setProfile: (p: UserProfile | null) => void) {
  try {
    const uid = user.id;
    const email = (user.email || user.user_metadata?.email || user.user_metadata?.email_address || '').toLowerCase();

    let profile = await getSupabaseUserProfile(uid, email);
    if (!profile && email) {
      // Create a minimal profile for new signups
      const newProfile: UserProfile = {
        uid,
        email,
        name: (user.user_metadata?.full_name || user.user_metadata?.name || '').trim() || 'Student',
        role: 'student'
      };
      try {
        profile = await saveSupabaseUserProfile(newProfile);
      } catch (e) {
        console.error('[AUTH-HANDLE] Failed to create new Supabase profile:', e);
      }
    }

    setProfile(profile);
  } catch (e) {
    console.error('[AUTH-HANDLE] Error handling session:', e);
    setProfile(null);
  }
}

export async function signInWithGoogle(): Promise<any> {
  try {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Must match the URL added in Supabase Auth → URL Configuration → Redirect URLs.
        // Using window.location.origin means this works in both dev and deployed environments
        // without needing separate configurations.
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
  } catch (e) {
    console.error('[AUTH] signInWithGoogle failed:', e);
    throw e;
  }
}
