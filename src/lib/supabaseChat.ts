import { supabase } from './supabase';
import { 
  ChatMessage, ChatRoom, UserProfile, 
  ChatServer, ServerChannel, CustomRole, ServerMember, MessageReadReceiptDetail 
} from '../types';

let cachedProfiles: UserProfile[] = [];
let lastFetchTime = 0;

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  const now = Date.now();
  if (cachedProfiles.length > 0 && now - lastFetchTime < 10000) {
    return cachedProfiles;
  }

  try {
    const { data, error } = await supabase.from('user_profiles').select('*');
    if (!error && data && data.length > 0) {
      cachedProfiles = data.map(item => ({
        uid: item.uid || item.id,
        name: item.name || 'StudentOS Member',
        email: item.email || '',
        role: item.role || 'student',
        avatar: item.photo_url || '',
        photoURL: item.photo_url || '',
        grade: item.grade || '',
        section: item.section || '',
        house: item.house || '',
        department: item.department || '',
        specialtySubject: item.specialty_subject || '',
        designation: item.designation || '',
        phone: item.raw_data?.phone || (item as any).phone || '',
        bio: item.bio || '',
        lastLogin: item.updated_at ? new Date(item.updated_at).getTime() : Date.now()
      }));
      lastFetchTime = now;
      return cachedProfiles;
    }
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Error fetching user profiles:', err);
  }
  return cachedProfiles;
}

export async function getOrCreateDirectMessageRoom(
  user1: { uid: string; name: string; avatar?: string; role?: string },
  user2: { uid: string; name: string; avatar?: string; role?: string }
): Promise<ChatRoom> {
  const sortedUids = [user1.uid, user2.uid].sort();
  const dmRoomId = `dm_${sortedUids[0]}_${sortedUids[1]}`;

  const dmRoom: ChatRoom = {
    id: dmRoomId,
    name: `${user1.name} & ${user2.name}`,
    type: 'friend',
    icon: '👤',
    description: `Private 1-on-1 conversation between ${user1.name} and ${user2.name}`,
    creatorId: user1.uid,
    members: [user1.uid, user2.uid],
    moderators: [user1.uid, user2.uid]
  };

  await saveChatRoom(dmRoom);
  return dmRoom;
}

export interface AiBuddyThread {
  id: string;
  title: string;
  personaId: string;
  mode: 'explanatory' | 'socratic' | 'coder' | 'quiz_gen';
  messages: { role: 'user' | 'assistant'; content: string }[];
  attachedFile?: { name: string; content: string; size: number; type: string } | null;
  attachedFiles?: { name: string; content: string; size: number; type: string }[];
  userId: string;
  createdAt: number;
}

function getLocalAiBuddyKey(userId: string): string {
  return `s_os_ai_buddy_chats_${userId || 'guest'}`;
}

function getDefaultAiThreadsForUser(userId: string): AiBuddyThread[] {
  const now = Date.now();
  if (userId === 'demo-teacher-uid' || userId.includes('teacher')) {
    return [
      {
        id: `ai-thread-teacher-1`,
        title: 'AP Physics Lab Rubric & Lesson Plan',
        personaId: 'elara',
        mode: 'explanatory',
        messages: [
          { role: 'assistant', content: 'Welcome back, Professor Elara! I have prepared the rotational inertia lab grading rubric and differentiated problem sets for Grade 10 Sections A & B. Would you like to generate a formative quiz next?' },
          { role: 'user', content: 'Generate 3 conceptual questions on conservation of angular momentum for tomorrow\'s warmup.' },
          { role: 'assistant', content: 'Here are 3 conceptual warmup questions for Grade 10:\n\n1. **Ice Skater Spin**: Why does pulling arms inward increase angular velocity while angular momentum $L = I\\omega$ remains constant?\n2. **Neutron Star Collapse**: If a star\'s radius shrinks by a factor of $10$, by what factor does its rotational kinetic energy change?\n3. **Bicycle Wheel Gyroscope**: When holding a spinning wheel and inverting it on a rotating stool, what determines the direction of the stool\'s rotation?' }
        ],
        attachedFiles: [],
        userId,
        createdAt: now - 3600000
      }
    ];
  }
  if (userId === 'demo-admin-uid' || userId.includes('admin') && !userId.includes('super')) {
    return [
      {
        id: `ai-thread-admin-1`,
        title: 'Q3 Institutional Attendance & Schedule Audit',
        personaId: 'study_buddy',
        mode: 'explanatory',
        messages: [
          { role: 'assistant', content: 'Hello Principal Vance! Here is your administrative AI briefing. Campus attendance is at 96.4% this week, and 4 new resources were published by faculty.' }
        ],
        attachedFiles: [],
        userId,
        createdAt: now - 5400000
      }
    ];
  }
  if (userId === 'demo-parent-uid' || userId.includes('parent')) {
    return [
      {
        id: `ai-thread-parent-1`,
        title: 'Naitik\'s Weekly Academic Progress Summary',
        personaId: 'study_buddy',
        mode: 'explanatory',
        messages: [
          { role: 'assistant', content: 'Welcome, Rajesh! Naitik has completed 14 study hours this week with an 8-day streak and scored 94% on the latest Physics kinematics assessment. How can I help you support his learning goals?' }
        ],
        attachedFiles: [],
        userId,
        createdAt: now - 7200000
      }
    ];
  }
  if (userId === 'demo-super' || userId === 'demo-super-admin-uid' || userId.includes('super')) {
    return [
      {
        id: `ai-thread-super-1`,
        title: 'Orion Neural Engine Diagnostics & Curriculum Synthesis',
        personaId: 'study_buddy',
        mode: 'explanatory',
        messages: [
          { role: 'assistant', content: 'Welcome, Naitik (Super Admin)! All multi-provider LLM routers (Groq, Ministral, APInex, Nara) and Supabase realtime channels are operational. What would you like to build or analyze today?' }
        ],
        attachedFiles: [],
        userId,
        createdAt: now - 1800000
      }
    ];
  }
  return [
    {
      id: `ai-thread-${userId}-1`,
      title: 'Kinematics & Binary Search Trees Review',
      personaId: 'study_buddy',
      mode: 'explanatory',
      messages: [
        { role: 'assistant', content: 'Hey! 🚀 Welcome to your personal AI Buddy workspace. Your study threads, uploaded files, and Socratic sessions are synced specifically to your profile account.\n\nWhat topic should we tackle today?' }
      ],
      attachedFiles: [],
      userId,
      createdAt: now - 3600000
    }
  ];
}

function getLocalAiBuddyChats(userId: string): AiBuddyThread[] {
  try {
    const raw = localStorage.getItem(getLocalAiBuddyKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  const seeded = getDefaultAiThreadsForUser(userId);
  try {
    localStorage.setItem(getLocalAiBuddyKey(userId), JSON.stringify(seeded));
  } catch (_) {}
  return seeded;
}

function saveLocalAiBuddyChats(userId: string, threads: AiBuddyThread[]): void {
  try {
    localStorage.setItem(getLocalAiBuddyKey(userId), JSON.stringify(threads));
  } catch (_) {}
}

/**
 * Robust helper to fetch AI Buddy Chats from Supabase (ai_buddy_chats table & local backup).
 * Securely filters by userId to prevent exposure of other users' chats.
 * Syncs seamlessly across devices and browsers.
 */
export async function getAiBuddyChats(userId: string): Promise<AiBuddyThread[]> {
  if (!userId) return [];
  console.log('[SUPABASE-CHAT] Fetching ai_buddy_chats from Supabase for userId:', userId);
  
  const mergedMap = new Map<string, AiBuddyThread>();
  const localThreads = getLocalAiBuddyChats(userId);
  for (const t of localThreads) {
    if (!t.userId || t.userId === userId) {
      mergedMap.set(t.id, { ...t, userId });
    }
  }

  try {
    const { data, error } = await supabase
      .from('ai_buddy_chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      for (const item of data) {
        try {
          const parsedMsgs = typeof item.messages === 'string' ? JSON.parse(item.messages) : item.messages;
          const isWrapped = parsedMsgs && !Array.isArray(parsedMsgs) && parsedMsgs.messages;

          const rawMsgs: any[] = isWrapped ? parsedMsgs.messages : (Array.isArray(parsedMsgs) ? parsedMsgs : []);
          
          const cleanMsgs: { role: 'user' | 'assistant'; content: string }[] = [];
          if (Array.isArray(rawMsgs)) {
            for (const msg of rawMsgs) {
              if (!msg || typeof msg.content !== 'string' || !msg.content.trim()) continue;
              const last = cleanMsgs[cleanMsgs.length - 1];
              if (last && last.role === msg.role && last.content.trim() === msg.content.trim()) {
                continue;
              }
              cleanMsgs.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
              });
            }
          }

          mergedMap.set(item.id, {
            id: item.id,
            title: item.title,
            personaId: isWrapped ? parsedMsgs.personaId : 'study_buddy',
            mode: isWrapped ? parsedMsgs.mode : 'explanatory',
            messages: cleanMsgs,
            attachedFiles: isWrapped ? parsedMsgs.attachedFiles : [],
            userId: item.user_id,
            createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now()
          });
        } catch (parseErr) {
          console.warn('[SUPABASE-CHAT] Failed to parse ai_buddy_chats row:', item.id, parseErr);
        }
      }
    } else if (error && error.code !== '42P01') {
      console.warn('[SUPABASE-CHAT] Query error on ai_buddy_chats table:', error.message);
    }
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Error querying ai_buddy_chats table:', err);
  }

  const finalThreads = Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  saveLocalAiBuddyChats(userId, finalThreads);
  return finalThreads;
}

/**
 * Robust helper to upsert an AI Buddy Chat thread to Supabase
 */
export async function saveAiBuddyChat(thread: AiBuddyThread): Promise<void> {
  if (!thread.userId) return;
  console.log('[SUPABASE-CHAT] Saving ai_buddy_chat thread:', thread.id);

  const cleanMessages: { role: 'user' | 'assistant'; content: string }[] = [];
  if (Array.isArray(thread.messages)) {
    for (const msg of thread.messages) {
      if (!msg || typeof msg.content !== 'string' || !msg.content.trim()) continue;
      const last = cleanMessages[cleanMessages.length - 1];
      if (last && last.role === msg.role && last.content.trim() === msg.content.trim()) {
        continue;
      }
      cleanMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    }
  }

  // Save immediately to per-user localStorage
  const existingLocal = getLocalAiBuddyChats(thread.userId);
  const updatedThread: AiBuddyThread = {
    ...thread,
    messages: cleanMessages,
    createdAt: thread.createdAt || Date.now()
  };
  const nextLocal = [updatedThread, ...existingLocal.filter(t => t.id !== thread.id)];
  saveLocalAiBuddyChats(thread.userId, nextLocal);

  const payloadString = JSON.stringify({
    messages: cleanMessages,
    personaId: thread.personaId || 'study_buddy',
    mode: thread.mode || 'explanatory',
    attachedFiles: thread.attachedFiles || []
  });

  try {
    const dbRow = {
      id: thread.id,
      user_id: thread.userId,
      title: thread.title || 'Study Session',
      messages: payloadString,
      created_at: new Date(thread.createdAt || Date.now()).toISOString()
    };

    const { error } = await supabase
      .from('ai_buddy_chats')
      .upsert(dbRow);

    if (error && error.code !== '42P01') {
      console.warn('[SUPABASE-CHAT] Table ai_buddy_chats upsert notice:', error.message);
    }
    
    // Also save messages individually to the ai_buddy_messages table as secondary log if present
    if (cleanMessages.length > 0) {
      try {
        await supabase.from('ai_buddy_messages').delete().eq('thread_id', thread.id);
        const messagesToInsert = cleanMessages.map(msg => ({
          thread_id: thread.id,
          role: msg.role,
          content: msg.content
        }));
        await supabase.from('ai_buddy_messages').insert(messagesToInsert);
      } catch (msgErr) {
        // Safe to ignore secondary table errors as primary JSON payload is persisted
      }
    }

  } catch (err) {
    console.warn('[SUPABASE-CHAT] Error saving ai buddy chat:', err);
  }
}

/**
 * Robust helper to delete an AI Buddy Chat thread from Supabase
 */
export async function deleteAiBuddyChat(threadId: string, userId: string): Promise<void> {
  console.log('[SUPABASE-CHAT] Deleting ai_buddy_chat:', threadId);
  if (userId) {
    const existing = getLocalAiBuddyChats(userId).filter(t => t.id !== threadId);
    saveLocalAiBuddyChats(userId, existing);
  }

  try {
    await supabase.from('ai_buddy_messages').delete().eq('thread_id', threadId);
    await supabase
      .from('ai_buddy_chats')
      .delete()
      .eq('id', threadId)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Error deleting from ai_buddy_chats:', err);
  }
}

const LOCAL_PEER_MESSAGES_KEY = 's_os_peer_messages_v2';
const LOCAL_CHAT_ROOMS_KEY = 's_os_chat_rooms_v2';

const DEFAULT_PEER_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-seed-1',
    name: 'Prof. Elara Vance',
    role: 'teacher',
    house: 'Sapphire',
    message: 'Welcome everyone to the General Lounge! Remember that the AP Physics Rotational Dynamics packet is now live in the Materials Hub.',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    targetId: 'group-all',
    ownerUid: 'demo-teacher-uid'
  },
  {
    id: 'msg-seed-2',
    name: 'Aarav Sharma',
    role: 'student',
    house: 'Ruby',
    message: 'Thank you Professor Elara! Just bookmarked the packet and started working on the torque problems.',
    createdAt: new Date(Date.now() - 5400000).toISOString(),
    targetId: 'group-all',
    ownerUid: 'demo-student-uid'
  },
  {
    id: 'msg-seed-3',
    name: 'Principal Arthur Vance',
    role: 'admin',
    house: 'Emerald',
    message: 'Reminder: Inter-House Science & Robotics Exhibition registration closes this Friday at 5:00 PM.',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    targetId: 'group-all',
    ownerUid: 'demo-admin-uid'
  },
  {
    id: 'msg-seed-dm-1',
    name: 'Prof. Elara Vance',
    role: 'teacher',
    house: 'Sapphire',
    message: 'Hi Aarav, great job on your kinematics lab submission! Let me know if you have questions on angular momentum.',
    createdAt: new Date(Date.now() - 3000000).toISOString(),
    targetId: 'dm_demo-student-uid_demo-teacher-uid',
    ownerUid: 'demo-teacher-uid'
  },
  {
    id: 'msg-seed-dm-2',
    name: 'Aarav Sharma',
    role: 'student',
    house: 'Ruby',
    message: 'Thanks Professor! I will review the moment of inertia derivations before tomorrow\'s class.',
    createdAt: new Date(Date.now() - 2400000).toISOString(),
    targetId: 'dm_demo-student-uid_demo-teacher-uid',
    ownerUid: 'demo-student-uid'
  }
];

function getLocalPeerMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_PEER_MESSAGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  try {
    localStorage.setItem(LOCAL_PEER_MESSAGES_KEY, JSON.stringify(DEFAULT_PEER_MESSAGES));
  } catch (_) {}
  return [...DEFAULT_PEER_MESSAGES];
}

function saveLocalPeerMessages(msgs: ChatMessage[]): void {
  try {
    localStorage.setItem(LOCAL_PEER_MESSAGES_KEY, JSON.stringify(msgs));
  } catch (_) {}
}

let peerMessagesPromise: Promise<ChatMessage[]> | null = null;
let lastPeerMessagesFetch = 0;
let cachedPeerMessages: ChatMessage[] = [];

let chatRoomsPromises = new Map<string, Promise<ChatRoom[]>>();
let lastRoomsFetchTime = new Map<string, number>();
let cachedRoomsMap = new Map<string, ChatRoom[]>();

export function clearChatCache() {
  lastPeerMessagesFetch = 0;
  lastRoomsFetchTime.clear();
  cachedRoomsMap.clear();
}

/**
 * Robust helper to fetch Peer/Group Messages from Supabase chat_room_messages table + local backup
 */
export async function getPeerMessages(force = false): Promise<ChatMessage[]> {
  const now = Date.now();
  if (!force && cachedPeerMessages.length > 0 && now - lastPeerMessagesFetch < 3000) {
    return cachedPeerMessages;
  }
  if (peerMessagesPromise) {
    return peerMessagesPromise;
  }

  peerMessagesPromise = (async () => {
    console.log('[SUPABASE-CHAT] Fetching room/peer messages from Supabase...');
    const msgMap = new Map<string, ChatMessage>();
    for (const m of getLocalPeerMessages()) {
      msgMap.set(m.id, m);
    }

    const parseMessagePayload = (rawMsg: string): { text: string; meta: Partial<ChatMessage> } => {
      if (typeof rawMsg === 'string' && rawMsg.startsWith('__EXTENDED_CHAT__::')) {
        try {
          const parsed = JSON.parse(rawMsg.substring('__EXTENDED_CHAT__::'.length));
          return {
            text: parsed.message || '',
            meta: parsed
          };
        } catch (_) {}
      }
      return { text: rawMsg || '', meta: {} };
    };

    // 1. Query 'chat_room_messages' table (limit to latest 30 rows with timeout race)
    try {
      const queryPromise = supabase
        .from('chat_room_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) => {
        setTimeout(() => resolve({ data: null, error: new Error('chat_room_messages query timeout') }), 4000);
      });

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (!error && Array.isArray(data)) {
        data.forEach(item => {
          let parsedDate = new Date();
          if (item.created_at) {
            parsedDate = new Date(item.created_at);
          }
          const { text, meta } = parseMessagePayload(item.content || '');
          msgMap.set(item.id, {
            id: item.id,
            name: item.sender_name || 'Student',
            role: item.sender_role || 'student',
            house: item.sender_house || 'Ruby',
            message: text,
            createdAt: parsedDate.toISOString(),
            targetId: item.room_id || 'group-all',
            sharedMaterialId: item.shared_material_id,
            ownerUid: item.sender_id || '',
            replyToId: meta.replyToId,
            replyToText: meta.replyToText,
            replyToSender: meta.replyToSender,
            attachments: meta.attachments,
            reactions: meta.reactions,
            readBy: meta.readBy,
            deliveredTo: meta.deliveredTo,
            isEdited: meta.isEdited,
            editedAt: meta.editedAt,
            isPinned: meta.isPinned,
            deletedForEveryone: meta.deletedForEveryone,
            deletedFor: meta.deletedFor,
            flaggedReason: meta.flaggedReason
          } as ChatMessage);
        });
      } else if (error) {
        console.warn('[SUPABASE-CHAT] Notice querying chat_room_messages table:', error.message);
      }
    } catch (err) {
      console.warn('[SUPABASE-CHAT] Error querying chat_room_messages table:', err);
    }

    const result = Array.from(msgMap.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    saveLocalPeerMessages(result);
    cachedPeerMessages = result;
    lastPeerMessagesFetch = Date.now();
    return result;
  })().finally(() => {
    peerMessagesPromise = null;
  });

  return peerMessagesPromise;
}

/**
 * Robust helper to save Peer/Group Message to Supabase chat_room_messages
 */
export async function savePeerMessage(message: ChatMessage): Promise<void> {
  console.log('[SUPABASE-CHAT] Saving message to Supabase chat_room_messages:', message.id);

  // Save to localStorage immediately
  const existing = getLocalPeerMessages();
  const idx = existing.findIndex(m => m.id === message.id);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...message };
  } else {
    existing.push(message);
  }
  saveLocalPeerMessages(existing);
  cachedPeerMessages = existing;

  const hasExtra = !!(
    message.replyToId ||
    (message.attachments && message.attachments.length > 0) ||
    message.reactions ||
    message.readBy ||
    message.isEdited ||
    message.isPinned ||
    message.deletedForEveryone ||
    message.deletedFor ||
    message.flaggedReason
  );

  const formattedContent = hasExtra
    ? `__EXTENDED_CHAT__::${JSON.stringify({
        message: message.message,
        replyToId: message.replyToId,
        replyToText: message.replyToText,
        replyToSender: message.replyToSender,
        attachments: message.attachments,
        reactions: message.reactions,
        readBy: message.readBy,
        deliveredTo: message.deliveredTo,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
        isPinned: message.isPinned,
        deletedForEveryone: message.deletedForEveryone,
        deletedFor: message.deletedFor,
        flaggedReason: message.flaggedReason
      })}`
    : message.message;

  // Save to 'chat_room_messages' table
  try {
    const dbRowChat = {
      id: message.id,
      room_id: message.targetId || 'group-all',
      sender_id: message.ownerUid || 'anonymous',
      sender_name: message.name || 'Student',
      sender_role: message.role || 'student',
      sender_house: message.house || 'Ruby',
      content: formattedContent,
      shared_material_id: message.sharedMaterialId || null,
      created_at: message.createdAt ? new Date(message.createdAt).toISOString() : new Date().toISOString()
    };
    const { error } = await supabase.from('chat_room_messages').upsert(dbRowChat);
    if (error) {
      console.warn('[SUPABASE-CHAT] Error upserting to chat_room_messages:', error.message);
    }

    // Broadcast Realtime Event
    try {
      supabase.channel('student-os-public').send({
        type: 'broadcast',
        event: 'new_chat_message',
        payload: message
      });
      if (message.targetId) {
        supabase.channel(`room_channel_${message.targetId}`).send({
          type: 'broadcast',
          event: 'new_chat_message',
          payload: message
        });
      }
    } catch (_) {}
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Exception saving to chat_room_messages:', err);
  }
}

/**
 * Rename AI Buddy Chat
 */
export async function renameAiBuddyChat(threadId: string, title: string, userId: string): Promise<void> {
  if (!userId || !threadId) return;
  console.log('[SUPABASE-CHAT] Renaming ai_buddy_chat:', threadId, 'to:', title);
  const existing = getLocalAiBuddyChats(userId).map(t => t.id === threadId ? { ...t, title } : t);
  saveLocalAiBuddyChats(userId, existing);
  try {
    await supabase
      .from('ai_buddy_chats')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', threadId)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Error renaming ai_buddy_chats:', err);
  }
}

/**
 * Delete Peer Message
 */
export async function deletePeerMessage(messageId: string): Promise<void> {
  console.log('[SUPABASE-CHAT] Deleting message:', messageId);
  const next = getLocalPeerMessages().filter(m => m.id !== messageId);
  saveLocalPeerMessages(next);
  cachedPeerMessages = next;
  try {
    await supabase.from('chat_room_messages').delete().eq('id', messageId);
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Error deleting message:', err);
  }
}

/**
 * Chat Rooms list helpers - Filtered by current user membership for private group security
 */
export async function getChatRooms(userId?: string, force = false): Promise<ChatRoom[]> {
  const cacheKey = userId || 'all';
  const now = Date.now();
  if (!force && cachedRoomsMap.has(cacheKey) && now - (lastRoomsFetchTime.get(cacheKey) || 0) < 3000) {
    return cachedRoomsMap.get(cacheKey)!;
  }
  if (chatRoomsPromises.has(cacheKey)) {
    return chatRoomsPromises.get(cacheKey)!;
  }

  const promise = (async () => {
    console.log('[SUPABASE-CHAT] Querying chat_rooms from Supabase for userId:', userId);
    const roomMap = new Map<string, ChatRoom>();

    try {
      // 1. Fetch joined room IDs from chat_room_members table if userId is available
      const joinedRoomIds = new Set<string>();
      if (userId) {
        try {
          const { data: memberRows } = await supabase
            .from('chat_room_members')
            .select('room_id')
            .eq('user_id', userId);

          if (memberRows) {
            memberRows.forEach(r => joinedRoomIds.add(r.room_id));
          }
        } catch (mErr) {
          console.warn('[SUPABASE-CHAT] Notice querying chat_room_members:', mErr);
        }
      }

      // 2. Query chat_rooms table
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*');

      if (!error && data && data.length > 0) {
        data.forEach(item => {
          let description = item.description || '';
          let code = '';
          let type = 'group';
          let icon = '💬';
          let members: string[] = [];
          let moderators: string[] = [];
          let creatorId = '';

          if (description.startsWith('__JSON_METADATA__::')) {
            try {
              const parsed = JSON.parse(description.substring('__JSON_METADATA__::'.length));
              description = parsed.description || '';
              code = parsed.code || '';
              type = parsed.type || 'group';
              icon = parsed.icon || '💬';
              members = parsed.members || [];
              moderators = parsed.moderators || [];
              creatorId = parsed.creatorId || '';
            } catch (_) {}
          }

          const roomObj: ChatRoom = {
            id: item.id,
            name: item.name,
            description,
            code,
            type: type as any,
            icon,
            creatorId,
            members: Array.isArray(members) ? members : [],
            moderators: Array.isArray(moderators) ? moderators : []
          };

          // If userId is provided, filter for privacy: only show rooms the user has joined, created, or global/channels
          if (!userId) {
            roomMap.set(item.id, roomObj);
          } else {
            const isGlobal = item.id === 'group-all' || type === 'channel' || members.includes('all');
            const isCreator = creatorId === userId;
            const isMemberArray = members.includes(userId);
            const isMemberTable = joinedRoomIds.has(item.id);

            if (isGlobal || isCreator || isMemberArray || isMemberTable) {
              roomMap.set(item.id, roomObj);
            }
          }
        });
      }

      // If General Lounge is missing, seed it
      if (!roomMap.has('group-all')) {
        const defaultRoom: ChatRoom = {
          id: 'group-all',
          name: 'General Lounge',
          type: 'group',
          icon: '🌍',
          description: 'General school-wide chat room for all students and teachers',
          code: 'GLOBAL',
          creatorId: 'system',
          members: ['all'],
          moderators: ['system']
        };
        await saveChatRoom(defaultRoom);
        roomMap.set(defaultRoom.id, defaultRoom);
      }
    } catch (err) {
      console.warn('[SUPABASE-CHAT] Notice querying chat_rooms:', err);
    }

    const roomsList = Array.from(roomMap.values());
    cachedRoomsMap.set(cacheKey, roomsList);
    lastRoomsFetchTime.set(cacheKey, Date.now());
    return roomsList;
  })().finally(() => {
    chatRoomsPromises.delete(cacheKey);
  });

  chatRoomsPromises.set(cacheKey, promise);
  return promise;
}

export async function saveChatRoom(room: ChatRoom): Promise<void> {
  console.log('[SUPABASE-CHAT] Saving chat room to Supabase:', room.id);
  
  const metaPayload = JSON.stringify({
    description: room.description || '',
    code: room.code || Math.random().toString(36).substring(2, 8).toUpperCase(),
    type: room.type || 'group',
    icon: room.icon || '💬',
    creatorId: room.creatorId || '',
    members: room.members || [],
    moderators: room.moderators || []
  });

  // Save ONLY valid columns to chat_rooms table (id, name, description, created_at)
  try {
    const dbRow = {
      id: room.id,
      name: room.name,
      description: `__JSON_METADATA__::${metaPayload}`,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('chat_rooms').upsert(dbRow);
    if (error) {
      console.warn('[SUPABASE-CHAT] Error upserting to chat_rooms:', error.message);
    }

    // Sync chat_room_members table
    if (room.members && room.members.length > 0) {
      for (const memberUid of room.members) {
        if (!memberUid || memberUid === 'all') continue;
        const isMod = room.moderators?.includes(memberUid) || memberUid === room.creatorId;
        try {
          await supabase.from('chat_room_members').upsert({
            room_id: room.id,
            user_id: memberUid,
            role: isMod ? 'admin' : 'member'
          }, { onConflict: 'room_id,user_id' });
        } catch (_) {}
      }
    }

    // Broadcast Realtime Event
    try {
      supabase.channel('student-os-public').send({
        type: 'broadcast',
        event: 'room_updated',
        payload: room
      });
    } catch (_) {}
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Notice saving to chat_rooms:', err);
  }
}

export async function regenerateRoomCode(room: ChatRoom): Promise<string> {
  const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  room.code = newCode;
  await saveChatRoom(room);
  return newCode;
}

export interface JoinRoomResult {
  success: boolean;
  room?: ChatRoom;
  alreadyJoined?: boolean;
  message?: string;
}

export async function joinChatRoom(roomCodeOrId: string, userId: string): Promise<JoinRoomResult> {
  if (!roomCodeOrId || !userId) {
    return { success: false, message: 'Invalid room code or user ID.' };
  }
  const cleanCode = roomCodeOrId.trim().toUpperCase();
  console.log('[SUPABASE-CHAT] Joining chat room with code/id:', cleanCode, 'for user:', userId);

  try {
    // 1. Fetch ALL rooms from Supabase chat_rooms table to find matching invite code or ID
    const { data: allRoomsData, error } = await supabase.from('chat_rooms').select('*');
    if (error || !allRoomsData || allRoomsData.length === 0) {
      console.warn('[SUPABASE-CHAT] Failed to query rooms for invite code:', cleanCode);
      return { success: false, message: 'Room code not found or invalid.' };
    }

    let targetRoom: ChatRoom | null = null;
    for (const item of allRoomsData) {
      let code = '';
      let description = item.description || '';
      let type = 'group';
      let icon = '💬';
      let members: string[] = [];
      let moderators: string[] = [];
      let creatorId = '';

      if (description.startsWith('__JSON_METADATA__::')) {
        try {
          const parsed = JSON.parse(description.substring('__JSON_METADATA__::'.length));
          description = parsed.description || '';
          code = parsed.code || '';
          type = parsed.type || 'group';
          icon = parsed.icon || '💬';
          members = parsed.members || [];
          moderators = parsed.moderators || [];
          creatorId = parsed.creatorId || '';
        } catch (_) {}
      }

      if (
        (code && code.toUpperCase() === cleanCode) || 
        (item.id && item.id.toUpperCase() === cleanCode) ||
        item.id === roomCodeOrId.trim()
      ) {
        targetRoom = {
          id: item.id,
          name: item.name,
          description,
          code,
          type: type as any,
          icon,
          creatorId,
          members: Array.isArray(members) ? members : [],
          moderators: Array.isArray(moderators) ? moderators : []
        };
        break;
      }
    }

    if (!targetRoom) {
      console.warn('[SUPABASE-CHAT] Room code not found:', cleanCode);
      return { success: false, message: 'Room code not found or invalid.' };
    }

    // Check if user is already a member
    const currentMembers = targetRoom.members || [];
    let isAlreadyMember = currentMembers.includes(userId);

    try {
      const { data: memberRow } = await supabase
        .from('chat_room_members')
        .select('*')
        .eq('room_id', targetRoom.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (memberRow) {
        isAlreadyMember = true;
      }
    } catch (_) {}

    if (isAlreadyMember) {
      return { success: true, room: targetRoom, alreadyJoined: true, message: 'Already joined this room!' };
    }

    // Add user to targetRoom.members
    targetRoom.members = [...currentMembers, userId];

    // Persist updated membership in chat_rooms metadata
    await saveChatRoom(targetRoom);

    // Explicitly insert into chat_room_members table
    try {
      await supabase.from('chat_room_members').upsert({
        room_id: targetRoom.id,
        user_id: userId,
        role: 'member'
      }, { onConflict: 'room_id,user_id' });
    } catch (_) {}

    return { success: true, room: targetRoom, alreadyJoined: false, message: `Joined room: ${targetRoom.name}` };
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Error joining room:', err);
    return { success: false, message: 'Failed to join room. Please try again.' };
  }
}

export async function leaveChatRoom(roomId: string, userId: string): Promise<void> {
  if (!roomId || !userId) return;
  console.log('[SUPABASE-CHAT] Leaving chat room:', roomId, 'user:', userId);

  try {
    const rooms = await getChatRooms();
    const targetRoom = rooms.find(r => r.id === roomId);
    if (!targetRoom) return;

    targetRoom.members = (targetRoom.members || []).filter(m => m !== userId);
    targetRoom.moderators = (targetRoom.moderators || []).filter(m => m !== userId);
    await saveChatRoom(targetRoom);

    await supabase
      .from('chat_room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    try {
      supabase.channel('student-os-public').send({
        type: 'broadcast',
        event: 'room_left',
        payload: { roomId, userId }
      });
    } catch (_) {}
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Error leaving room:', err);
  }
}

export async function deleteChatRoom(roomId: string, userId?: string): Promise<void> {
  if (!roomId) return;
  console.log('[SUPABASE-CHAT] Deleting chat room:', roomId);

  try {
    await supabase.from('chat_room_messages').delete().eq('room_id', roomId);
    await supabase.from('chat_room_members').delete().eq('room_id', roomId);
    await supabase.from('chat_rooms').delete().eq('id', roomId);

    try {
      supabase.channel('student-os-public').send({
        type: 'broadcast',
        event: 'room_deleted',
        payload: { roomId }
      });
    } catch (_) {}
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Error deleting room:', err);
  }
}

// ==========================================
// DISCORD-STYLE SERVERS, CHANNELS, ROLES & READ RECEIPTS
// ==========================================

const STORAGE_KEY_SERVERS = 's_os_chat_servers_v2';
const STORAGE_KEY_RECEIPTS = 's_os_message_receipts_v2';
const STORAGE_KEY_CUSTOM_ROLES = 's_os_custom_roles_v2';

export const DEFAULT_SERVERS: ChatServer[] = [
  {
    id: 'server_campus_main',
    name: 'Campus Central',
    icon: '🏛️',
    description: 'Official StudentOS institution community server for all faculties, student bodies, and extracurricular guilds.',
    ownerId: 'super-admin-root',
    inviteCode: 'CAMPUS',
    bannerUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80',
    roles: [
      {
        id: 'role_head_prefect',
        name: 'Head Prefect / Guildmaster',
        color: '#f59e0b',
        priority: 100,
        isDefault: false,
        permissions: {
          canSendMessages: true,
          canAttachFiles: true,
          canManageMessages: true,
          canManageChannels: true,
          canManageRoles: true
        }
      },
      {
        id: 'role_faculty_mentor',
        name: 'Faculty Mentor',
        color: '#6366f1',
        priority: 80,
        isDefault: false,
        permissions: {
          canSendMessages: true,
          canAttachFiles: true,
          canManageMessages: true,
          canManageChannels: true,
          canManageRoles: false
        }
      },
      {
        id: 'role_student_scholar',
        name: 'Student Scholar',
        color: '#10b981',
        priority: 20,
        isDefault: true,
        permissions: {
          canSendMessages: true,
          canAttachFiles: true,
          canManageMessages: false,
          canManageChannels: false,
          canManageRoles: false
        }
      }
    ],
    channels: [
      {
        id: 'server_campus_main_announcements',
        serverId: 'server_campus_main',
        name: '📢-campus-announcements',
        type: 'announcement',
        category: 'Announcements',
        topic: 'Official institutional notifications and faculty announcements.'
      },
      {
        id: 'server_campus_main_general',
        serverId: 'server_campus_main',
        name: '💬-general-lounge',
        type: 'text',
        category: 'General',
        topic: 'Campus-wide open discussions, social hub, and student catch-up.'
      },
      {
        id: 'server_campus_main_doubts',
        serverId: 'server_campus_main',
        name: '💡-academics-and-doubts',
        type: 'class',
        category: 'Class & Doubts',
        topic: 'Peer problem solving, math proofs, physics questions, and homework help.'
      },
      {
        id: 'server_campus_main_study',
        serverId: 'server_campus_main',
        name: '🎧-silent-study-lounge',
        type: 'text',
        category: 'Study Lounge',
        topic: 'Focus sessions, Pomodoro co-working, and quiet collaboration.'
      }
    ],
    members: ['demo-super-admin-uid', 'demo_alice', 'demo_bob', 'demo_charlie', 'teacher_sharma'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'server_stem_society',
    name: 'STEM Society & Robotics',
    icon: '⚡',
    description: 'Robotics, software engineering, math olympiads, and high-impact science research labs.',
    ownerId: 'super-admin-root',
    inviteCode: 'ROBOTICS',
    bannerUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    roles: [
      {
        id: 'role_lab_director',
        name: 'Lab Director',
        color: '#ec4899',
        priority: 90,
        permissions: {
          canSendMessages: true,
          canAttachFiles: true,
          canManageMessages: true,
          canManageChannels: true,
          canManageRoles: true
        }
      },
      {
        id: 'role_stem_researcher',
        name: 'Research Fellow',
        color: '#06b6d4',
        priority: 30,
        isDefault: true,
        permissions: {
          canSendMessages: true,
          canAttachFiles: true,
          canManageMessages: false,
          canManageChannels: false,
          canManageRoles: false
        }
      }
    ],
    channels: [
      {
        id: 'server_stem_robotics',
        serverId: 'server_stem_society',
        name: '🤖-autonomous-robotics',
        type: 'text',
        category: 'General',
        topic: 'Microcontrollers, CAD design, ROS, and competition hardware.'
      },
      {
        id: 'server_stem_olympiad',
        serverId: 'server_stem_society',
        name: '📐-math-olympiad-prep',
        type: 'class',
        category: 'Class & Doubts',
        topic: 'AMC, AIME, Putnam, and combinatorial geometry problems.'
      },
      {
        id: 'server_stem_code',
        serverId: 'server_stem_society',
        name: '💻-software-and-ai',
        type: 'text',
        category: 'General',
        topic: 'Full-stack development, LLM engineering, and algorithms.'
      }
    ],
    members: ['demo-super-admin-uid', 'demo_alice', 'demo_charlie'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'server_academic_houses',
    name: 'Academic House Champions',
    icon: '🛡️',
    description: 'Inter-house tournaments, Solara, Astra, Elara, Vega leagues, and spirit rallies.',
    ownerId: 'super-admin-root',
    inviteCode: 'HOUSES',
    bannerUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
    roles: [
      {
        id: 'role_house_captain',
        name: 'House Captain',
        color: '#ef4444',
        priority: 85,
        permissions: {
          canSendMessages: true,
          canAttachFiles: true,
          canManageMessages: true,
          canManageChannels: true,
          canManageRoles: false
        }
      }
    ],
    channels: [
      {
        id: 'server_house_standings',
        serverId: 'server_academic_houses',
        name: '🏆-leaderboard-updates',
        type: 'announcement',
        category: 'Announcements',
        topic: 'Live house point tallies and competition results.'
      },
      {
        id: 'server_house_solara',
        serverId: 'server_academic_houses',
        name: '☀️-house-solara',
        type: 'text',
        category: 'General',
        topic: 'Solara House team strategy and study groups.'
      },
      {
        id: 'server_house_astra',
        serverId: 'server_academic_houses',
        name: '⭐-house-astra',
        type: 'text',
        category: 'General',
        topic: 'Astra House team discussions.'
      }
    ],
    members: ['demo-super-admin-uid', 'demo_alice', 'demo_bob', 'demo_diana'],
    createdAt: new Date().toISOString()
  }
];

export async function getChatServers(): Promise<ChatServer[]> {
  try {
    const { data, error } = await supabase.from('chat_servers').select('*');
    if (!error && Array.isArray(data) && data.length > 0) {
      const parsed: ChatServer[] = data.map((row: any) => {
        const ownerId = row.owner_id || '';
        const rawMembers = row.members || [];
        const members = Array.from(new Set([ownerId, ...rawMembers]));
        return {
          id: row.id,
          name: row.name,
          icon: row.icon || '💬',
          description: row.description || '',
          ownerId,
          inviteCode: row.invite_code || row.id.split('_').pop()?.toUpperCase(),
          bannerUrl: row.banner_url,
          channels: row.channels || [],
          roles: row.roles || [],
          members,
          mutedMembers: row.muted_members || [],
          memberRoles: row.member_roles || {},
          createdAt: row.created_at || new Date().toISOString()
        };
      });
      localStorage.setItem(STORAGE_KEY_SERVERS, JSON.stringify(parsed));
      return parsed;
    }
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Falling back to cached servers:', err);
  }

  const cached = localStorage.getItem(STORAGE_KEY_SERVERS);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s: ChatServer) => ({
          ...s,
          members: Array.from(new Set([s.ownerId, ...(s.members || [])]))
        }));
      }
    } catch (_) {}
  }

  const defaultWithMembers = DEFAULT_SERVERS.map(s => ({
    ...s,
    members: Array.from(new Set([s.ownerId, ...(s.members || [])]))
  }));
  localStorage.setItem(STORAGE_KEY_SERVERS, JSON.stringify(defaultWithMembers));
  return defaultWithMembers;
}

export async function saveChatServer(server: ChatServer): Promise<ChatServer> {
  const allMembers = Array.from(new Set([server.ownerId, ...(server.members || [])]));
  const payload = {
    id: server.id,
    name: server.name,
    icon: server.icon,
    description: server.description,
    owner_id: server.ownerId,
    invite_code: server.inviteCode || server.id.split('_').pop()?.toUpperCase(),
    banner_url: server.bannerUrl || null,
    channels: server.channels || [],
    roles: server.roles || [],
    members: allMembers,
    muted_members: server.mutedMembers || [],
    member_roles: server.memberRoles || {},
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('chat_servers').upsert(payload);
  if (error && error.code !== '42P01') {
    console.error('[SUPABASE-CHAT] Save server upsert error:', error);
    throw new Error(error.message || 'Failed to save server');
  }

  const servers = await getChatServers();
  const updatedServer = { ...server, members: allMembers };
  const existingIdx = servers.findIndex(s => s.id === server.id);
  if (existingIdx >= 0) {
    servers[existingIdx] = updatedServer;
  } else {
    servers.push(updatedServer);
  }
  localStorage.setItem(STORAGE_KEY_SERVERS, JSON.stringify(servers));

  try {
    supabase.channel('student-os-public').send({
      type: 'broadcast',
      event: 'server_updated',
      payload: { serverId: server.id }
    });
  } catch (_) {}

  return updatedServer;
}

export async function createChatServerChannel(serverId: string, channel: ServerChannel): Promise<ServerChannel> {
  const servers = await getChatServers();
  const targetServer = servers.find(s => s.id === serverId);
  if (!targetServer) throw new Error('Server not found');

  const channels = targetServer.channels || [];
  if (!channels.some(c => c.id === channel.id)) {
    channels.push(channel);
  }
  targetServer.channels = channels;
  await saveChatServer(targetServer);

  // Server channels are stored inside targetServer.channels in chat_servers only.
  // They are NOT saved to chat_rooms to prevent them from showing up under Home / DMs.

  return channel;
}

export async function deleteChatServerChannel(serverId: string, channelId: string): Promise<void> {
  const servers = await getChatServers();
  const targetServer = servers.find(s => s.id === serverId);
  if (!targetServer) return;

  targetServer.channels = (targetServer.channels || []).filter(c => c.id !== channelId);
  await saveChatServer(targetServer);
}

export async function saveCustomRole(serverIdOrGroupId: string, role: CustomRole): Promise<CustomRole> {
  const servers = await getChatServers();
  const targetServer = servers.find(s => s.id === serverIdOrGroupId);
  if (targetServer) {
    const roles = targetServer.roles || [];
    const idx = roles.findIndex(r => r.id === role.id);
    if (idx >= 0) roles[idx] = role;
    else roles.push(role);
    targetServer.roles = roles;
    await saveChatServer(targetServer);
    return role;
  }

  const groupRolesKey = `${STORAGE_KEY_CUSTOM_ROLES}_${serverIdOrGroupId}`;
  try {
    const current = JSON.parse(localStorage.getItem(groupRolesKey) || '[]');
    const idx = current.findIndex((r: any) => r.id === role.id);
    if (idx >= 0) current[idx] = role;
    else current.push(role);
    localStorage.setItem(groupRolesKey, JSON.stringify(current));
  } catch (_) {}

  return role;
}

export async function deleteCustomRole(serverIdOrGroupId: string, roleId: string): Promise<void> {
  const servers = await getChatServers();
  const targetServer = servers.find(s => s.id === serverIdOrGroupId);
  if (targetServer) {
    targetServer.roles = (targetServer.roles || []).filter(r => r.id !== roleId);
    await saveChatServer(targetServer);
    return;
  }

  const groupRolesKey = `${STORAGE_KEY_CUSTOM_ROLES}_${serverIdOrGroupId}`;
  try {
    const current = JSON.parse(localStorage.getItem(groupRolesKey) || '[]');
    const updated = current.filter((r: any) => r.id !== roleId);
    localStorage.setItem(groupRolesKey, JSON.stringify(updated));
  } catch (_) {}
}

export async function markMessageAsRead(
  messageId: string, 
  user: { uid: string; name: string; avatar?: string; role?: string }
): Promise<void> {
  if (!messageId || !user?.uid) return;

  const receipt: MessageReadReceiptDetail = {
    userId: user.uid,
    userName: user.name,
    userAvatar: user.avatar,
    role: user.role,
    readAt: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from('chat_message_receipts').upsert({
      message_id: messageId,
      user_id: user.uid,
      user_name: user.name,
      user_avatar: user.avatar || null,
      role: user.role || 'student',
      read_at: receipt.readAt
    }, { onConflict: 'message_id,user_id' });

    if (error && error.code !== '42P01') {
      console.warn('[SUPABASE-CHAT] Failed to upsert receipt:', error);
    }
  } catch (err) {
    console.warn('[SUPABASE-CHAT] Receipt error:', err);
  }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_RECEIPTS) || '{}');
    if (!stored[messageId]) stored[messageId] = [];
    if (!stored[messageId].some((r: any) => r.userId === user.uid)) {
      stored[messageId].push(receipt);
      localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(stored));
    }
  } catch (_) {}
}

export async function getMessageReadReceipts(
  messageId: string,
  memberIds: string[] = []
): Promise<{ readBy: MessageReadReceiptDetail[]; unreadBy: string[] }> {
  let readBy: MessageReadReceiptDetail[] = [];

  try {
    const { data, error } = await supabase
      .from('chat_message_receipts')
      .select('*')
      .eq('message_id', messageId);

    if (!error && Array.isArray(data)) {
      readBy = data.map((r: any) => ({
        userId: r.user_id,
        userName: r.user_name || 'Member',
        userAvatar: r.user_avatar,
        role: r.role,
        readAt: r.read_at
      }));
    }
  } catch (_) {}

  if (readBy.length === 0) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_RECEIPTS) || '{}');
      if (stored[messageId]) {
        readBy = stored[messageId];
      }
    } catch (_) {}
  }

  const readUserIds = new Set(readBy.map(r => r.userId));
  const unreadBy = memberIds.filter(id => !readUserIds.has(id));

  return { readBy, unreadBy };
}











export async function joinChatServer(inviteCode: string, userId: string): Promise<{ success: boolean; message: string; server?: ChatServer }> {
  if (!inviteCode || !userId) return { success: false, message: 'Invite code not found.' };
  const cleanCode = inviteCode.trim().toUpperCase();

  try {
    const servers = await getChatServers();
    const target = servers.find(s => 
      (s.inviteCode && s.inviteCode.toUpperCase() === cleanCode) ||
      (s.id && s.id.toUpperCase() === cleanCode) ||
      (s.id && s.id.split('_').pop()?.toUpperCase() === cleanCode)
    );

    if (!target) {
      return { success: false, message: 'Invite code not found.' };
    }

    const members = Array.from(new Set([target.ownerId, ...(target.members || [])]));
    if (members.includes(userId)) {
      return { success: true, message: `Already a member of ${target.name}!`, server: target };
    }

    const updatedMembers = [...members, userId];
    const updatedServer = { ...target, members: updatedMembers };
    await saveChatServer(updatedServer);

    return { success: true, message: `Joined server "${target.name}"!`, server: updatedServer };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Invite code not found.' };
  }
}

export async function deleteChatServer(serverId: string): Promise<void> {
  const { error } = await supabase.from('chat_servers').delete().eq('id', serverId);
  if (error && error.code !== '42P01') {
    throw new Error(error.message || 'Failed to delete server');
  }
  const servers = await getChatServers();
  const filtered = servers.filter(s => s.id !== serverId);
  localStorage.setItem(STORAGE_KEY_SERVERS, JSON.stringify(filtered));

  try {
    supabase.channel('student-os-public').send({
      type: 'broadcast',
      event: 'server_deleted',
      payload: { serverId }
    });
  } catch (_) {}
}

export async function transferServerOwnership(serverId: string, newOwnerId: string): Promise<ChatServer> {
  const servers = await getChatServers();
  const server = servers.find(s => s.id === serverId);
  if (!server) throw new Error('Server not found');

  const members = Array.from(new Set([newOwnerId, server.ownerId, ...(server.members || [])]));
  const updated: ChatServer = {
    ...server,
    ownerId: newOwnerId,
    members
  };
  return await saveChatServer(updated);
}

export async function muteServerMember(serverId: string, userId: string, mute: boolean): Promise<ChatServer> {
  const servers = await getChatServers();
  const server = servers.find(s => s.id === serverId);
  if (!server) throw new Error('Server not found');

  const muted = new Set(server.mutedMembers || []);
  if (mute) muted.add(userId);
  else muted.delete(userId);

  const updated: ChatServer = {
    ...server,
    mutedMembers: Array.from(muted)
  };
  return await saveChatServer(updated);
}

export async function removeServerMember(serverId: string, userId: string): Promise<ChatServer> {
  const servers = await getChatServers();
  const server = servers.find(s => s.id === serverId);
  if (!server) throw new Error('Server not found');

  if (userId === server.ownerId) {
    throw new Error('Cannot remove the server owner.');
  }

  const members = (server.members || []).filter(id => id !== userId);
  const updated: ChatServer = {
    ...server,
    members
  };
  return await saveChatServer(updated);
}


