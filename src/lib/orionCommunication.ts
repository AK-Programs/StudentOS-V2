import { ChatMessage, ChatRoom, AppNotification } from '../types';
import { savePeerMessage, saveChatRoom } from './supabaseChat';
import { saveAppNotification } from './notifications';

export interface OrionDispatchResult {
  actionExecuted: string;
  targetChannels: string[];
  notificationsSent: number;
  addedToNoticeBoard: boolean;
  addedToCalendar: boolean;
  summaryText: string;
}

/**
 * Orion Communication Dispatch Engine
 * Parses natural language commands or Principal voice inputs and dispatches multi-channel alerts
 */
export async function executeOrionCommunicationDispatch(
  prompt: string,
  senderName: string = 'Principal',
  chatRooms: ChatRoom[],
  onNoticeBoardAdd?: (title: string, content: string) => void,
  onCalendarAdd?: (title: string, dateStr: string) => void
): Promise<OrionDispatchResult> {
  const lower = prompt.toLowerCase().trim();

  // Determine target class or if it's general school-wide
  const classMatch = lower.match(/class\s+(\d+[a-z]?)/i);
  const targetClass = classMatch ? `Class ${classMatch[1].toUpperCase()}` : null;

  const isGeneralAnnouncement = !targetClass;

  // Generate Message Content
  const cleanContent = prompt
    .replace(/announce\s+/i, '')
    .replace(/tell\s+class\s+\d+[a-z]?\s+to\s+/i, '')
    .replace(/tell\s+everyone\s+/i, '');

  const announcementTitle = targetClass
    ? `📢 Notice for ${targetClass}`
    : `📢 Official School Announcement`;

  const announcementMessage = `[Orion Assistant Alert]: ${cleanContent}`;

  const targetChannels: string[] = [];
  let notificationsSent = 0;

  if (targetClass) {
    // Find or create target class channel
    let classRoom = chatRooms.find(r => r.name.toLowerCase().includes(targetClass.toLowerCase()));
    if (!classRoom) {
      classRoom = {
        id: `channel-${targetClass.toLowerCase().replace(/\s+/g, '-')}`,
        name: `${targetClass} Channel`,
        type: 'channel',
        channelCategory: 'class',
        icon: '🏫',
        description: `Official channel for ${targetClass}`,
        code: `CLS${targetClass.replace(/\s+/g, '')}`
      };
      await saveChatRoom(classRoom);
    }
    targetChannels.push(classRoom.name);

    // Save Chat Message
    await savePeerMessage({
      id: `msg-${Date.now()}-orion`,
      name: `${senderName} (via Orion)`,
      role: 'admin',
      message: announcementMessage,
      createdAt: new Date().toISOString(),
      targetId: classRoom.id,
      readBy: [],
      deliveredTo: []
    });

    // Save Notification
    await saveAppNotification({
      id: `notif-${Date.now()}-orion`,
      title: announcementTitle,
      message: cleanContent,
      type: 'announcement',
      createdAt: new Date().toISOString(),
      isRead: false,
      targetUserId: 'all',
      targetClass: targetClass,
      linkTab: 'peer_chat'
    });
    notificationsSent += 1;
  } else {
    // School-wide multi-channel dispatch
    const schoolChannels = chatRooms.filter(r => r.type === 'channel' || r.id === 'group-all');
    for (const room of schoolChannels) {
      targetChannels.push(room.name);
      await savePeerMessage({
        id: `msg-${Date.now()}-${room.id}`,
        name: `${senderName} (via Orion)`,
        role: 'admin',
        message: announcementMessage,
        createdAt: new Date().toISOString(),
        targetId: room.id,
        readBy: [],
        deliveredTo: []
      });
    }

    // Save global notification
    await saveAppNotification({
      id: `notif-${Date.now()}-global`,
      title: announcementTitle,
      message: cleanContent,
      type: 'announcement',
      createdAt: new Date().toISOString(),
      isRead: false,
      targetUserId: 'all',
      linkTab: 'peer_chat'
    });
    notificationsSent += 1;

    // Add to notice board & calendar if requested
    if (onNoticeBoardAdd) {
      onNoticeBoardAdd(announcementTitle, cleanContent);
    }
    if (onCalendarAdd) {
      onCalendarAdd(cleanContent.slice(0, 30), new Date().toISOString().split('T')[0]);
    }
  }

  return {
    actionExecuted: targetClass ? `Targeted Class Notice Dispatched` : `School-Wide Multi-Channel Broadcast`,
    targetChannels,
    notificationsSent,
    addedToNoticeBoard: isGeneralAnnouncement,
    addedToCalendar: isGeneralAnnouncement,
    summaryText: targetClass
      ? `Successfully sent notice to ${targetClass} students and posted in ${targetChannels.join(', ')}.`
      : `Broadcasted school announcement to ${targetChannels.length} channels, sent push notifications, updated notice board, and added event to school calendar.`
  };
}
