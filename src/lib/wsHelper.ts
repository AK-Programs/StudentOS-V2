// If your app previously attempted to create a raw WebSocket to the Vercel host, that will fail.
// Replace raw WebSocket usage with Supabase Realtime or guard it behind a feature flag.

// This helper exports a safe connect function that returns a Supabase realtime channel when available
import { supabase } from './supabase';

export function createRealtimeChannel(channelName: string) {
  try {
    const ch = supabase.channel(channelName);
    return ch;
  } catch (e) {
    console.warn('[WS-HELPER] Failed to create Supabase realtime channel:', e);
    return null;
  }
}
