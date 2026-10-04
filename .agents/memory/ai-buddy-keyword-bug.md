---
name: AI buddy keyword false-match bug
description: Why clientAiFallback.ts triggered physics response for unrelated messages
---

`getMockAiResponse` used `String.prototype.includes('work')` which matched "workspace" inside the chat history context string, causing the centripetal force physics response for ANY message (even "hello").

**Why:** The AI fallback call in App.tsx was building a full context string: `System: ... History:\nTutor: Hey buddy! Welcome to your Campus AI workspace...\n\nStudent: hello`. The word "workspace" contains "work".

**Fix:**
1. `clientAiFallback.ts` now uses `\bword\b` regex (word boundaries) for all keyword checks.
2. App.tsx now passes only `promptWithContext` (the user's message) to `clientSideGemini`, not the full system+history string.
