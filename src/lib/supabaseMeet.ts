import { supabase } from './supabase';
import { Meeting, MeetingParticipant, MeetingChatMessage, MeetingRecording, MeetingBreakoutRoom } from '../types';

const STORAGE_KEY_MEETINGS = 'studentos_meet_meetings_v1';
const STORAGE_KEY_CHATS = 'studentos_meet_chats_v1';
const STORAGE_KEY_RECORDINGS = 'studentos_meet_recordings_v1';

// Seed sample upcoming & live meetings for demo/testing
const defaultSampleMeetings: Meeting[] = [
  {
    id: 'INSTANT-9-ASTRA',
    title: 'Grade 9 Astra - Permanent Instant Room',
    subject: 'General Class & Collaboration',
    className: 'Grade 9 - Astra',
    batch: 'Batch 2026',
    type: 'instant',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    description: 'Shared permanent virtual room for Grade 9 Astra students and teachers.',
    password: '',
    hostId: 'host',
    hostName: 'Faculty Host',
    hostEmail: 'faculty@school.edu',
    hostRole: 'teacher',
    joinLink: (typeof window !== 'undefined' ? window.location.origin : '') + '?meet=INSTANT-9-ASTRA',
    status: 'live',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'INSTANT-8-ELERA',
    title: 'Grade 8 Elera - Permanent Instant Room',
    subject: 'General Class & Collaboration',
    className: 'Grade 8 - Elera',
    batch: 'Batch 2026',
    type: 'instant',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    description: 'Shared permanent virtual room for Grade 8 Elera students and teachers.',
    password: '',
    hostId: 'host',
    hostName: 'Faculty Host',
    hostEmail: 'faculty@school.edu',
    hostRole: 'teacher',
    joinLink: (typeof window !== 'undefined' ? window.location.origin : '') + '?meet=INSTANT-8-ELERA',
    status: 'live',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'INSTANT-7-SOLARA',
    title: 'Grade 7 Solara - Permanent Instant Room',
    subject: 'General Class & Collaboration',
    className: 'Grade 7 - Solara',
    batch: 'Batch 2026',
    type: 'instant',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    description: 'Shared permanent virtual room for Grade 7 Solara students and teachers.',
    password: '',
    hostId: 'host',
    hostName: 'Faculty Host',
    hostEmail: 'faculty@school.edu',
    hostRole: 'teacher',
    joinLink: (typeof window !== 'undefined' ? window.location.origin : '') + '?meet=INSTANT-7-SOLARA',
    status: 'live',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'meet-892-412-890',
    title: 'Advanced Quantum Physics & Electromagnetism',
    subject: 'Physics',
    className: 'Grade 11 - Astra',
    batch: 'Batch 2026',
    type: 'scheduled',
    startTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // Started 15 mins ago
    endTime: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
    description: 'Deep dive into Wave-Particle Duality and Maxwell Equations with live whiteboard demonstrations.',
    password: '123456',
    hostId: 'demo-teacher-uid',
    hostName: 'Dr. Sarah Jenkins (Physics Faculty)',
    hostEmail: 'physics.teacher@school.edu',
    hostRole: 'teacher',
    joinLink: (typeof window !== 'undefined' ? window.location.origin : '') + '?meet=meet-892-412-890',
    isLocked: false,
    isMutedAll: false,
    isCameraDisabledAll: false,
    isChatDisabled: false,
    isScreenShareDisabled: false,
    isFileShareDisabled: false,
    invitedClasses: ['Grade 11_Astra', 'Grade 12_Vega'],
    isSchoolWide: false,
    status: 'live',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'meet-105-992-304',
    title: 'School-Wide Annual Academic Convocation & Assembly',
    subject: 'General Assembly',
    className: 'All Grades & Staff',
    batch: 'School-Wide',
    type: 'scheduled',
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(), // 3 hours from now
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
    description: 'Principal Special Assembly address regarding annual championships, national science olympiad, and academic honors.',
    password: 'assembly2026',
    hostId: 'demo-admin-uid',
    hostName: 'Prof. Arthur Vance (Principal)',
    hostEmail: 'admin@school.edu',
    hostRole: 'super_admin',
    joinLink: (typeof window !== 'undefined' ? window.location.origin : '') + '?meet=meet-105-992-304',
    isSchoolWide: true,
    status: 'upcoming',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'meet-332-110-449',
    title: 'Organic Chemistry Reactions & Synthesis Laboratory',
    subject: 'Chemistry',
    className: 'Grade 10 - Ruby',
    type: 'scheduled',
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // tomorrow
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 25).toISOString(),
    description: 'Electrophilic Addition, Reaction Mechanisms, and Spectral Analysis workshop.',
    password: 'chem99',
    hostId: 'demo-teacher-uid',
    hostName: 'Dr. Sarah Jenkins',
    hostEmail: 'physics.teacher@school.edu',
    hostRole: 'teacher',
    joinLink: (typeof window !== 'undefined' ? window.location.origin : '') + '?meet=meet-332-110-449',
    status: 'upcoming',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export function getLocalMeetings(): Meeting[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEETINGS);
    let parsed: Meeting[] = [];
    if (raw) {
      parsed = JSON.parse(raw);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(defaultSampleMeetings));
      return defaultSampleMeetings;
    }
    // Ensure default permanent instant rooms exist in list
    const missingInstants = defaultSampleMeetings.filter(dm => dm.id.startsWith('INSTANT-') && !parsed.some(m => m.id === dm.id));
    if (missingInstants.length > 0) {
      parsed = [...missingInstants, ...parsed];
      localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(parsed));
    }
    return parsed;
  } catch (err) {
    console.warn('[StudentOS Meet] Failed reading local meetings', err);
    return defaultSampleMeetings;
  }
}

export function saveLocalMeetings(meetings: Meeting[]) {
  try {
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(meetings));
  } catch (err) {
    console.warn('[StudentOS Meet] Failed saving local meetings', err);
  }
}

export async function fetchAllMeetings(): Promise<Meeting[]> {
  try {
    const { data, error } = await supabase.from('meetings').select('*').order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      const meetings: Meeting[] = data.map((row: any) => ({
        id: row.id,
        title: row.title,
        subject: row.subject || 'General',
        className: row.class_name,
        batch: row.batch,
        type: row.type || 'scheduled',
        startTime: row.start_time,
        endTime: row.end_time,
        description: row.description,
        password: row.password,
        hostId: row.host_id,
        hostName: row.host_name,
        hostEmail: row.host_email,
        hostRole: row.host_role,
        joinLink: row.join_link || ((typeof window !== 'undefined' ? window.location.origin : '') + '?meet=' + row.id),
        isLocked: row.is_locked,
        isMutedAll: row.is_muted_all,
        isCameraDisabledAll: row.is_camera_disabled_all,
        isChatDisabled: row.is_chat_disabled,
        isScreenShareDisabled: row.is_screenshare_disabled,
        isFileShareDisabled: row.is_fileshare_disabled,
        invitedUsers: row.invited_users || [],
        invitedClasses: row.invited_classes || [],
        isSchoolWide: row.is_school_wide,
        status: row.status || 'upcoming',
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      saveLocalMeetings(meetings);
      return meetings;
    }
  } catch (e) {
    console.warn('[StudentOS Meet] Supabase fetch meetings warning, falling back to local', e);
  }
  return getLocalMeetings();
}

export async function createOrUpdateMeeting(meeting: Meeting): Promise<Meeting> {
  // Sync to local state
  const local = getLocalMeetings();
  const idx = local.findIndex(m => m.id === meeting.id);
  if (idx >= 0) {
    local[idx] = meeting;
  } else {
    local.unshift(meeting);
  }
  saveLocalMeetings(local);

  // Sync to Supabase
  try {
    await supabase.from('meetings').upsert({
      id: meeting.id,
      title: meeting.title,
      subject: meeting.subject,
      class_name: meeting.className,
      batch: meeting.batch,
      type: meeting.type,
      start_time: meeting.startTime,
      end_time: meeting.endTime,
      description: meeting.description,
      password: meeting.password,
      host_id: meeting.hostId,
      host_name: meeting.hostName,
      host_email: meeting.hostEmail,
      host_role: meeting.hostRole,
      join_link: meeting.joinLink,
      is_locked: meeting.isLocked || false,
      is_muted_all: meeting.isMutedAll || false,
      is_camera_disabled_all: meeting.isCameraDisabledAll || false,
      is_chat_disabled: meeting.isChatDisabled || false,
      is_screenshare_disabled: meeting.isScreenShareDisabled || false,
      is_fileshare_disabled: meeting.isFileShareDisabled || false,
      invited_users: meeting.invitedUsers || [],
      invited_classes: meeting.invitedClasses || [],
      is_school_wide: meeting.isSchoolWide || false,
      status: meeting.status,
      created_at: meeting.createdAt,
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn('[StudentOS Meet] Supabase create meeting error', e);
  }

  return meeting;
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  try {
    const local = getLocalMeetings();
    const filtered = local.filter(m => m.id !== meetingId && m.id.toLowerCase() !== meetingId.toLowerCase());
    saveLocalMeetings(filtered);
    localStorage.removeItem(STORAGE_KEY_CHATS + '_' + meetingId);
  } catch (err) {
    console.warn('Failed local delete meeting', err);
  }

  try {
    await supabase.from('meetings').delete().eq('id', meetingId);
    await supabase.from('meeting_chat').delete().eq('meeting_id', meetingId);
  } catch (e) {
    console.warn('Failed supabase delete meeting', e);
  }
}

export async function endMeetingInStore(meetingId: string): Promise<void> {
  try {
    const local = getLocalMeetings();
    const updated = local.map(m => (m.id === meetingId || m.id.toLowerCase() === meetingId.toLowerCase()) ? { ...m, status: 'ended' as const } : m);
    saveLocalMeetings(updated);
  } catch (err) {
    console.warn('Failed local end meeting', err);
  }

  try {
    await supabase.from('meetings').update({ status: 'ended' }).eq('id', meetingId);
  } catch (e) {
    console.warn('Failed supabase end meeting', e);
  }
}

export async function saveMeetingChatMessage(msg: MeetingChatMessage): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHATS + '_' + msg.meetingId);
    const existing: MeetingChatMessage[] = raw ? JSON.parse(raw) : [];
    existing.push(msg);
    localStorage.setItem(STORAGE_KEY_CHATS + '_' + msg.meetingId, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed local chat save', e);
  }

  try {
    await supabase.from('meeting_chat').insert({
      id: msg.id,
      meeting_id: msg.meetingId,
      sender_id: msg.senderId,
      sender_name: msg.senderName,
      sender_role: msg.senderRole,
      sender_avatar: msg.senderAvatar,
      content: msg.content,
      attachment: msg.attachment ? JSON.stringify(msg.attachment) : null,
      timestamp: msg.timestamp,
      is_private: msg.isPrivate || false,
      recipient_id: msg.recipientId || null
    });
  } catch (e) {
    console.warn('Failed supabase chat insert', e);
  }
}

export function getLocalChatMessages(meetingId: string): MeetingChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHATS + '_' + meetingId);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function deleteMeetingChatMessage(meetingId: string, messageId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHATS + '_' + meetingId);
    if (raw) {
      const existing: MeetingChatMessage[] = JSON.parse(raw);
      const filtered = existing.filter(m => m.id !== messageId);
      localStorage.setItem(STORAGE_KEY_CHATS + '_' + meetingId, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('Failed local chat delete', e);
  }

  try {
    await supabase.from('meeting_chat').delete().eq('id', messageId);
  } catch (e) {
    console.warn('Failed supabase chat delete', e);
  }
}

export async function updateMeetingChatMessage(meetingId: string, messageId: string, newContent: string): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHATS + '_' + meetingId);
    if (raw) {
      const existing: MeetingChatMessage[] = JSON.parse(raw);
      const updated = existing.map(m => m.id === messageId ? { ...m, content: newContent } : m);
      localStorage.setItem(STORAGE_KEY_CHATS + '_' + meetingId, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Failed local chat edit', e);
  }

  try {
    await supabase.from('meeting_chat').update({ content: newContent }).eq('id', messageId);
  } catch (e) {
    console.warn('Failed supabase chat update', e);
  }
}

export async function recordMeetingAttendance(record: {
  meetingId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  joinedAt: string;
  leftAt: string;
  durationSeconds: number;
  cameraActiveSeconds: number;
  micActiveSeconds: number;
}): Promise<void> {
  try {
    const key = `studentos_meet_attendance_${record.meetingId}`;
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];
    existing.push(record);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed local attendance save', e);
  }

  try {
    await supabase.from('meeting_attendance').insert({
      meeting_id: record.meetingId,
      user_id: record.userId,
      user_name: record.userName,
      user_email: record.userEmail,
      user_role: record.userRole,
      joined_at: record.joinedAt,
      left_at: record.leftAt,
      duration_seconds: record.durationSeconds,
      camera_active_seconds: record.cameraActiveSeconds,
      mic_active_seconds: record.micActiveSeconds
    });
  } catch (e) {
    console.warn('Failed supabase attendance insert', e);
  }
}

export async function saveMeetingRecording(recording: MeetingRecording): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECORDINGS);
    const existing: MeetingRecording[] = raw ? JSON.parse(raw) : [];
    existing.unshift(recording);
    localStorage.setItem(STORAGE_KEY_RECORDINGS, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed saving local recording', e);
  }

  try {
    await supabase.from('meeting_recordings').insert({
      id: recording.id,
      meeting_id: recording.meetingId,
      title: recording.title,
      host_name: recording.hostName,
      url: recording.url,
      duration_seconds: recording.durationSeconds,
      size_bytes: recording.sizeBytes,
      created_at: recording.createdAt,
      ai_summary: recording.aiSummary || null
    });
  } catch (e) {
    console.warn('Failed saving supabase recording', e);
  }
}

export function getLocalRecordings(): MeetingRecording[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECORDINGS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
