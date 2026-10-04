# StudentOS

An AI-powered student platform with a React/Vite frontend, Express backend, Firebase auth/FCM, Supabase database, and NVIDIA AI tutoring personas.

**Founders:** Naitik Kashyap (Developer), Price Davda (UI Designer)

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Express (TypeScript) via `server.ts`, runs Vite in middleware mode
- **Auth:** Supabase OAuth (Google Sign-In) & Firebase Auth
- **Push Notifications:** Firebase Cloud Messaging (FCM) & Web Push (VAPID)
- **Database:** Supabase (PostgreSQL) — see `supabase-complete-schema.sql` for schema
- **AI Engine:** NVIDIA API (Nemotron 3 Super 120B, Nemotron 3 Ultra 550B, GPT-OSS 20B)
- **Real-time:** WebSocket server (`ws`) for chat, announcements, homework sync

## Running the App

```bash
npm run dev
```

Starts the Express + Vite dev server on **port 3000**.

## Required Secrets

Set these in the Secrets panel:

| Secret | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `NVIDIA_API_KEY` | NVIDIA API Key for AI tutoring, Orion, flashcards, and notes |
| `VAPID_PUBLIC_KEY` | Public VAPID key for Web Push & FCM notifications |
| `VAPID_PRIVATE_KEY` | Server-side Private VAPID key for push delivery |

> Without an AI key the app falls back to built-in deterministic educational responses.

## User Preferences

- Maintain the existing React + Express monorepo structure.
