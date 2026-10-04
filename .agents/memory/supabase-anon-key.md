---
name: Supabase anon key strategy
description: How the Supabase client key is configured and why it's hardcoded
---

The Supabase anon/public key is intentionally hardcoded in `src/lib/supabase.ts` as `DEFAULT_SUPABASE_ANON_KEY`. This is safe because Supabase designed the anon key to be embedded in client code — it's Row Level Security, not secrecy.

**Why:** The `VITE_SUPABASE_ANON_KEY` secret was truncated (missing JWT signature) causing 401 on all API calls. The correct key was already in `pages/AuthDebug.tsx`.

**How to apply:** `getEnvVar()` validates the key has 3 JWT parts before using the env var; if truncated it falls back to the hardcoded default and logs a warning.
