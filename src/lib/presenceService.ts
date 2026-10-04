import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface UserPresence {
  uid: string;
  name: string;
  email?: string;
  role?: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: number;
}

type PresenceCallback = (onlineUsers: Map<string, UserPresence>) => void;

class PresenceService {
  private channel: RealtimeChannel | null = null;
  private onlineMap = new Map<string, UserPresence>();
  private callbacks: Set<PresenceCallback> = new Set();
  private currentUserUid: string | null = null;
  private currentPayload: Partial<UserPresence> | null = null;

  public init(user: { uid: string; name: string; email?: string; role?: string; avatar?: string }) {
    if (this.currentUserUid === user.uid && this.channel) {
      return;
    }

    this.currentUserUid = user.uid;
    this.currentPayload = {
      uid: user.uid,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      status: 'online',
      lastSeen: Date.now(),
    };

    if (this.channel) {
      supabase.removeChannel(this.channel);
    }

    this.channel = supabase.channel('studentos_presence', {
      config: {
        presence: {
          key: user.uid,
        },
      },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        const newState = this.channel?.presenceState();
        this.updatePresenceMap(newState);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (newPresences && newPresences[0]) {
          const p = newPresences[0] as any;
          this.onlineMap.set(key, {
            uid: p.uid || key,
            name: p.name || 'Member',
            email: p.email,
            role: p.role,
            avatar: p.avatar,
            status: p.status || 'online',
            lastSeen: p.lastSeen || Date.now(),
          });
          this.notifySubscribers();
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        this.onlineMap.delete(key);
        this.notifySubscribers();
      });

    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && this.currentPayload) {
        await this.channel?.track(this.currentPayload);
      }
    });

    // Handle window beforeunload to mark offline
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  private updatePresenceMap(presenceState: any) {
    if (!presenceState) return;
    const newMap = new Map<string, UserPresence>();

    Object.keys(presenceState).forEach((key) => {
      const presences = presenceState[key];
      if (presences && presences.length > 0) {
        const p = presences[0];
        newMap.set(key, {
          uid: p.uid || key,
          name: p.name || 'Member',
          email: p.email,
          role: p.role,
          avatar: p.avatar,
          status: p.status || 'online',
          lastSeen: p.lastSeen || Date.now(),
        });
      }
    });

    this.onlineMap = newMap;
    this.notifySubscribers();
  }

  public subscribe(cb: PresenceCallback): () => void {
    this.callbacks.add(cb);
    cb(this.onlineMap);
    return () => {
      this.callbacks.delete(cb);
    };
  }

  private notifySubscribers() {
    this.callbacks.forEach((cb) => cb(this.onlineMap));
  }

  public isUserOnline(uid: string): boolean {
    if (!uid) return false;
    return this.onlineMap.has(uid);
  }

  public getUserPresence(uid: string): UserPresence | null {
    if (!uid) return null;
    return this.onlineMap.get(uid) || null;
  }

  public getOnlineMap(): Map<string, UserPresence> {
    return this.onlineMap;
  }

  public cleanup() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

export const presenceService = new PresenceService();
