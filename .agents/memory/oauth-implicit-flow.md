---
name: Supabase OAuth implicit flow — hash handling
description: Why setSession() fails after Google redirect and what to use instead
---

With `flowType: 'implicit'` and `detectSessionInUrl: true`, the Supabase SDK automatically parses the URL hash and stores the session locally when the client initializes.

**Why setSession() breaks:** `supabase.auth.setSession()` makes a server-side validation call that requires the anon key header. If the key is wrong/missing, it returns 401 and the session is never stored.

**Correct approach:** Call `supabase.auth.getSession()` after the hash redirect — the SDK already handled it. Never call `setSession()` manually in implicit flow.

**How to apply:** In the `hasHashParams` branch of the auth init effect in App.tsx, always use `supabase.auth.getSession()` and trust the SDK's `detectSessionInUrl` processing.
