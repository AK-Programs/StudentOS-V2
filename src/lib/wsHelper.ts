// Unified Real-Time Signaling & Collaboration Bus for StudentOS
// Combines subscribed Supabase Realtime channels, BroadcastChannel (instant same-device multi-tab),
// and optional dev WebSocket relay with idempotent envelope deduplication and send queuing.
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

type EventHandler = (payload: any) => void;

interface ManagedChannel {
  name: string;
  sbChannel: any;
  isSubscribed: boolean;
  pendingQueue: Array<{ event: string; payload: any; envelopeId: string }>;
  listeners: Map<string, Set<EventHandler>>;
  refCount: number;
}

const managedChannels = new Map<string, ManagedChannel>();
const processedEnvelopes = new Set<string>();
let broadcastChan: BroadcastChannel | null = null;
let devWs: WebSocket | null = null;
let devWsConnecting = false;

function markEnvelopeProcessed(envelopeId?: string): boolean {
  if (!envelopeId) return false;
  if (processedEnvelopes.has(envelopeId)) return true;
  processedEnvelopes.add(envelopeId);
  if (processedEnvelopes.size > 2000) {
    const first = processedEnvelopes.values().next().value;
    if (first) processedEnvelopes.delete(first);
  }
  return false;
}

function dispatchIncomingEvent(channel: string, event: string, payload: any, envelopeId?: string) {
  if (markEnvelopeProcessed(envelopeId)) return;
  const entry = managedChannels.get(channel);
  if (entry) {
    const handlers = entry.listeners.get(event);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(payload);
        } catch (err) {
          console.warn('[RealtimeBus] Handler error:', err);
        }
      });
    }
  }
}

function getDevWebSocket(): WebSocket | null {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return null;
  if (window.location.hostname.endsWith('.vercel.app')) return null;
  if (devWs && (devWs.readyState === WebSocket.OPEN || devWs.readyState === WebSocket.CONNECTING)) {
    return devWs;
  }
  if (devWsConnecting) return null;
  try {
    devWsConnecting = true;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}`);
    devWs = ws;
    ws.onopen = () => {
      devWsConnecting = false;
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg && msg.type === 'realtime:relay' && msg.channel && msg.event) {
          dispatchIncomingEvent(msg.channel, msg.event, msg.data, msg.envelopeId);
        }
      } catch (_) {}
    };
    ws.onerror = () => {
      devWsConnecting = false;
    };
    ws.onclose = () => {
      devWsConnecting = false;
      devWs = null;
    };
    return ws;
  } catch (_) {
    devWsConnecting = false;
    return null;
  }
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!broadcastChan) {
    try {
      broadcastChan = new BroadcastChannel('studentos_realtime_bus_v1');
      broadcastChan.onmessage = (evt) => {
        const msg = evt.data;
        if (!msg || !msg.channel || !msg.event) return;
        dispatchIncomingEvent(msg.channel, msg.event, msg.payload, msg.envelopeId);
      };
    } catch (_) {
      broadcastChan = null;
    }
  }
  return broadcastChan;
}

function getOrCreateManagedChannel(channelName: string): ManagedChannel {
  let entry = managedChannels.get(channelName);
  if (entry) return entry;

  const sbChannel = supabase.channel(channelName, {
    config: {
      broadcast: { self: false, ack: false }
    }
  });

  entry = {
    name: channelName,
    sbChannel,
    isSubscribed: false,
    pendingQueue: [],
    listeners: new Map(),
    refCount: 0
  };

  managedChannels.set(channelName, entry);

  // Initialize BroadcastChannel and Dev WebSocket listeners
  getBroadcastChannel();
  getDevWebSocket();

  // Register unified event dispatcher BEFORE calling .subscribe() so any event name works at any time
  sbChannel.on('broadcast', { event: 'studentos_event' }, (rawMsg: any) => {
    const wrapper = rawMsg?.payload ?? rawMsg;
    if (!wrapper || !wrapper.subEvent) return;
    if (markEnvelopeProcessed(wrapper.__envelopeId)) return;
    const currentHandlers = entry?.listeners.get(wrapper.subEvent);
    if (currentHandlers) {
      currentHandlers.forEach((fn) => {
        try {
          fn(wrapper.data);
        } catch (e) {
          console.warn('[RealtimeBus] Event callback error:', e);
        }
      });
    }
  });

  sbChannel.subscribe((status: string) => {
    if (!entry) return;
    if (status === 'SUBSCRIBED') {
      entry.isSubscribed = true;
      // Flush queued messages that were sent while channel was still connecting
      while (entry.pendingQueue.length > 0) {
        const item = entry.pendingQueue.shift()!;
        try {
          sbChannel.send({
            type: 'broadcast',
            event: 'studentos_event',
            payload: { subEvent: item.event, data: item.payload, __envelopeId: item.envelopeId }
          });
          // Also emit legacy direct event for backward compatibility
          sbChannel.send({
            type: 'broadcast',
            event: item.event,
            payload: { ...item.payload, __envelopeId: item.envelopeId }
          });
        } catch (err) {
          console.warn('[RealtimeBus] Queue flush warning:', err);
        }
      }
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      entry.isSubscribed = false;
    }
  });

  return entry;
}

/**
 * Subscribe to a named channel and event Set.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeRealtimeEvents(
  channelName: string,
  events: Record<string, EventHandler>
): () => void {
  const entry = getOrCreateManagedChannel(channelName);
  entry.refCount += 1;

  Object.entries(events).forEach(([eventName, handler]) => {
    if (!entry.listeners.has(eventName)) {
      entry.listeners.set(eventName, new Set());
      // Also attach direct broadcast listener if not yet subscribed
      if (!entry.isSubscribed) {
        entry.sbChannel.on('broadcast', { event: eventName }, (rawMsg: any) => {
          const payload = rawMsg?.payload ?? rawMsg;
          const envId = payload?.__envelopeId;
          if (markEnvelopeProcessed(envId)) return;
          const currentHandlers = entry.listeners.get(eventName);
          if (currentHandlers) {
            currentHandlers.forEach((fn) => {
              try {
                fn(payload);
              } catch (e) {
                console.warn('[RealtimeBus] Event callback error:', e);
              }
            });
          }
        });
      }
    }
    entry.listeners.get(eventName)!.add(handler);
  });

  return () => {
    const current = managedChannels.get(channelName);
    if (!current) return;
    Object.entries(events).forEach(([eventName, handler]) => {
      const set = current.listeners.get(eventName);
      if (set) {
        set.delete(handler);
      }
    });
    current.refCount = Math.max(0, current.refCount - 1);
  };
}

/**
 * Reliably broadcast an event to a channel.
 * Automatically queues if the Supabase channel is still subscribing,
 * AND dispatches immediately on BroadcastChannel for zero-latency cross-tab delivery.
 */
export function sendRealtimeEvent(channelName: string, event: string, payload: any = {}) {
  const envelopeId = `env_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  markEnvelopeProcessed(envelopeId);

  // 1. Instant same-browser cross-tab delivery via BroadcastChannel
  const bc = getBroadcastChannel();
  if (bc) {
    try {
      bc.postMessage({
        channel: channelName,
        event,
        payload,
        envelopeId
      });
    } catch (_) {}
  }

  // 2. Express Dev/Preview WebSocket relay (if available)
  const ws = getDevWebSocket();
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: 'realtime:relay',
        channel: channelName,
        event,
        data: payload,
        envelopeId
      }));
    } catch (_) {}
  }

  // 3. Cross-device delivery via managed Supabase Realtime channel
  const entry = getOrCreateManagedChannel(channelName);
  if (entry.isSubscribed) {
    try {
      entry.sbChannel.send({
        type: 'broadcast',
        event: 'studentos_event',
        payload: { subEvent: event, data: payload, __envelopeId: envelopeId }
      });
      entry.sbChannel.send({
        type: 'broadcast',
        event,
        payload: { ...payload, __envelopeId: envelopeId }
      });
    } catch (e) {
      console.warn('[RealtimeBus] Supabase send error:', e);
    }
  } else {
    entry.pendingQueue.push({ event, payload, envelopeId });
  }
}

