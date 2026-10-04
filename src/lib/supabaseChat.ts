import { supabase } from './supabase';
import { ChatMessage, ChatRoom, UserProfile } from '../types';

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

/**
 * Robust helper to fetch AI Buddy Chats from Supabase (ai_buddy_chats table & notes backup).
 * Securely filters by userId to prevent exposure of other users' chats.
 * Syncs seamlessly across devices and browsers.
 */
export async function getAiBuddyChats(userId: string): Promise<AiBuddyThread[]> {
  if (!userId) return [];
  console.log('[SUPABASE-CHAT] Fetching ai_buddy_chats from Supabase for userId:', userId);
  
  const mergedMap = new Map<string, AiBuddyThread>();

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

  return Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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

let peerMessagesPromise: Promise<ChatMessage[]> | null = null;
let lastPeerMessagesFetch = 0;
let cachedPeerMessages: ChatMessage[] = [];

let chatRoomsPromises = new Map<string, Promise<ChatRoom[]>>();
let lastRoomsFetchTime = new Map<string, number>();
let cachedRoomsMap = new Map<string, ChatRoom[]>();

export function clearChatCache() {
  lastPeerMessagesFetch = 0;
  lastRoomsFetchTime.clear();
}

/**
 * Robust helper to fetch Peer/Group Messages from Supabase chat_room_messages table
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

    // 1. Query 'chat_room_messages' table (primary table for room messages)
    try {
      const { data, error } = await supabase
        .from('chat_room_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
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
// LOCAL STORAGE BACKUP IMPLEMENTATION
// ==========================================














