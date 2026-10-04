# StudentOS

An AI-powered student platform with a React/Vite frontend, Express backend, Firebase auth, Supabase database, and AI tutoring personas.

**Founders:** Naitik Kashyap (Developer), Price Davda (UI Designer)

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Express (TypeScript) via `server.ts`, runs Vite in middleware mode
- **Auth:** Supabase OAuth (Google Sign-In)
- **Database:** Supabase (PostgreSQL) — see `supabase-migration.sql` for schema
- **AI:** Google Gemini SDK or OpenRouter (configurable via secrets)
- **Real-time:** WebSocket server (`ws`) for chat, announcements, homework sync

## Running the App

```bash
npm run dev
```

Starts the Express + Vite dev server on **port 3000**.

## Required Secrets

Set these in the Secrets panel before running:

| Secret | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `GEMINI_API_KEY` | Google Gemini API (for AI features) |
| `OPENROUTER_API_KEY` | OpenRouter API (alternative AI provider — takes priority over Gemini if set) |

> Without an AI key the app falls back to built-in simulated responses.

## Supabase Setup

1. Run `supabase-migration.sql` in the Supabase SQL Editor to create all tables and RLS policies.
2. Run `supabase-alter.sql` to apply any schema additions.
3. In the Supabase dashboard → **Authentication → URL Configuration**, add your deployed domain to **Redirect URLs**.

## Auth Flow Notes

- Uses Supabase OAuth with Google (`flowType: 'implicit'` in `src/lib/supabase.ts`).
- `signInWithGoogle()` in `src/lib/auth.ts` passes `redirectTo: window.location.origin` — ensure this matches the redirect URLs configured in Supabase.
- `getSupabaseUserProfile` in `src/lib/supabaseUsers.ts` looks up users by UUID → `firebase_uid` → email. After a first email-based lookup it asynchronously links the Supabase auth UUID to `firebase_uid` so subsequent logins resolve faster.
- Admin-added users (manually inserted in Supabase before first sign-in) are fully supported via the email fallback.

## User Preferences

- Maintain the existing React + Express monorepo structure — do not migrate to a separate frontend/backend setup.
