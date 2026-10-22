/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Realtime Presence Engine
 * Tracks active online users, their role, class, and active workspace tab.
 */

import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface UserPresence {
  uid: string;
  name: string;
  email?: string;
  role?: string;
  grade?: string;
  section?: string;
  currentTab?: string;
  schoolId?: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: number;
}

type PresenceCallback = (onlineUsers: Map<string, UserPresence>) => void;

// Campus mock presence seeds for multi-user visualization in demo/single-user dev environments
const DEMO_CAMPUS_PRESENCES: UserPresence[] = [
  {
    uid: 'demo_alice',
    name: 'Alice Smith',
    email: 'demo.alice@school.edu',
    role: 'student',
    grade: 'Grade 10',
    section: 'Solara',
    currentTab: 'study_hub',
    schoolId: 'dps-main',
    status: 'online',
    lastSeen: Date.now() - 30000
  },
  {
    uid: 'demo_bob',
    name: 'Bob Jones',
    email: 'demo.bob@school.edu',
    role: 'student',
    grade: 'Grade 10',
    section: 'Solara',
    currentTab: 'ai_teacher',
    schoolId: 'dps-main',
    status: 'online',
    lastSeen: Date.now() - 60000
  },
  {
    uid: 'demo_charlie',
    name: 'Charlie Brown',
    email: 'demo.charlie@school.edu',
    role: 'student',
    grade: 'Grade 10',
    section: 'Solara',
    currentTab: 'homework',
    schoolId: 'dps-main',
    status: 'online',
    lastSeen: Date.now() - 90000
  },
  {
    uid: 'demo_diana',
    name: 'Diana Prince',
    email: 'demo.diana@school.edu',
    role: 'student',
    grade: 'Grade 10',
    section: 'Vega',
    currentTab: 'whiteboard',
    schoolId: 'dps-main',
    status: 'online',
    lastSeen: Date.now() - 120000
  },
  {
    uid: 'teacher_sharma',
    name: 'Dr. Evelyn Reed',
    email: 'dr.reed@school.edu',
    role: 'teacher',
    grade: 'Grade 10',
    section: 'Solara',
    currentTab: 'attendance_manager',
    schoolId: 'dps-main',
    status: 'online',
    lastSeen: Date.now() - 15000
  }
];

class PresenceService {
  private channel: RealtimeChannel | null = null;
  private onlineMap = new Map<string, UserPresence>();
  private callbacks: Set<PresenceCallback> = new Set();
  private currentUserUid: string | null = null;
  private currentPayload: Partial<UserPresence> | null = null;

  constructor() {
    // Populate default campus peers
    DEMO_CAMPUS_PRESENCES.forEach(p => {
      this.onlineMap.set(p.uid, p);
    });
  }

  public init(user: {
    uid: string;
    name: string;
    email?: string;
    role?: string;
    grade?: string;
    section?: string;
    currentTab?: string;
    schoolId?: string;
    avatar?: string;
  }) {
    this.currentUserUid = user.uid;
    this.currentPayload = {
      uid: user.uid,
      name: user.name,
      email: user.email,
      role: user.role,
      grade: user.grade,
      section: user.section,
      currentTab: user.currentTab || 'dashboard',
      schoolId: user.schoolId || 'dps-main',
      avatar: user.avatar,
      status: 'online',
      lastSeen: Date.now(),
    };

    // Update local map with active authenticated user
    this.onlineMap.set(user.uid, this.currentPayload as UserPresence);
    this.notifySubscribers();

    if (this.channel) {
      supabase.removeChannel(this.channel);
    }

    try {
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
              grade: p.grade,
              section: p.section,
              currentTab: p.currentTab || 'dashboard',
              schoolId: p.schoolId,
              avatar: p.avatar,
              status: p.status || 'online',
              lastSeen: p.lastSeen || Date.now(),
            });
            this.notifySubscribers();
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          // If not in demo list, delete
          if (!DEMO_CAMPUS_PRESENCES.some(d => d.uid === key)) {
            this.onlineMap.delete(key);
          }
          this.notifySubscribers();
        });

      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && this.currentPayload) {
          await this.channel?.track(this.currentPayload);
        }
      });
    } catch (e) {
      console.warn('[Presence] Supabase realtime channel init fallback:', e);
    }

    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  public updateCurrentTab(tabId: string) {
    if (!this.currentUserUid || !this.currentPayload) return;

    this.currentPayload.currentTab = tabId;
    this.currentPayload.lastSeen = Date.now();

    const existing = this.onlineMap.get(this.currentUserUid);
    if (existing) {
      existing.currentTab = tabId;
      existing.lastSeen = Date.now();
      this.onlineMap.set(this.currentUserUid, existing);
      this.notifySubscribers();
    }

    if (this.channel && this.channel.state === 'joined') {
      this.channel.track(this.currentPayload).catch(() => {});
    }
  }

  private updatePresenceMap(presenceState: any) {
    if (!presenceState) return;

    // Retain demo seeds and active current user
    const newMap = new Map<string, UserPresence>();
    DEMO_CAMPUS_PRESENCES.forEach(p => newMap.set(p.uid, p));
    if (this.currentUserUid && this.currentPayload) {
      newMap.set(this.currentUserUid, this.currentPayload as UserPresence);
    }

    Object.keys(presenceState).forEach((key) => {
      const presences = presenceState[key];
      if (presences && presences.length > 0) {
        const p = presences[0];
        newMap.set(key, {
          uid: p.uid || key,
          name: p.name || 'Member',
          email: p.email,
          role: p.role,
          grade: p.grade,
          section: p.section,
          currentTab: p.currentTab || 'dashboard',
          schoolId: p.schoolId,
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

  public getOnlineList(): UserPresence[] {
    return Array.from(this.onlineMap.values());
  }

  public cleanup() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

export const presenceService = new PresenceService();
