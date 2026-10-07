/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS School-Context Calling System & State Machine
 * Authoritative lifecycle, triple-redundant signaling, FCM Web Push integration,
 * group call participant management, and educational context handling.
 */

import { supabase } from './supabase';
import { sendRealtimeEvent, subscribeRealtimeEvents } from './wsHelper';
import { UserProfile, UserRole } from '../types';
import { soundService } from './soundService';

export type CallStatus =
  | 'IDLE'
  | 'CREATED'
  | 'INVITED'
  | 'RINGING'
  | 'ACCEPTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'ENDED'
  | 'DECLINED'
  | 'MISSED'
  | 'EXPIRED'
  | 'FAILED';

export type CallContextType =
  | 'direct_call'
  | 'class_call'
  | 'student_call'
  | 'staff_call'
  | 'assignment_call'
  | 'lecture_call'
  | 'group_call';

export interface CallParticipant {
  uid: string;
  name: string;
  role: UserRole | string;
  avatar?: string;
  email?: string;
  grade?: string;
  section?: string;
  house?: string;
  status: 'invited' | 'ringing' | 'accepted' | 'declined' | 'connected' | 'left';
  isMuted?: boolean;
  isVideoOff?: boolean;
  stream?: MediaStream;
  joinedAt?: number;
}

export interface SchoolCallSession {
  callId: string;
  caller: CallParticipant;
  participants: CallParticipant[];
  type: 'audio' | 'video';
  contextType: CallContextType;
  contextTitle: string;
  contextId?: string; // e.g., assignment ID, lecture note ID, grade name
  contextSubtitle?: string;
  status: CallStatus;
  createdAt: number;
  acceptedAt?: number;
  endedAt?: number;
  schoolId: string;
  isHost: boolean;
  activeSpeakerUid?: string;
}

// Call state listener subscribers
type CallStateListener = (session: SchoolCallSession | null) => void;
const listeners = new Set<CallStateListener>();

let currentCallSession: SchoolCallSession | null = null;
let currentLocalStream: MediaStream | null = null;
let peerConnections = new Map<string, RTCPeerConnection>();
let remoteStreams = new Map<string, MediaStream>();
let callTimeoutTimer: any = null;
let currentUnsubscribers: Array<() => void> = [];

export function getActiveCallSession(): SchoolCallSession | null {
  return currentCallSession;
}

export function subscribeCallState(listener: CallStateListener): () => void {
  listeners.add(listener);
  listener(currentCallSession);
  return () => {
    listeners.delete(listener);
  };
}

function notifyCallState(session: SchoolCallSession | null) {
  currentCallSession = session;
  listeners.forEach(fn => {
    try {
      fn(session);
    } catch (e) {
      console.error('[CallService] Listener error:', e);
    }
  });
}

/**
 * Dispatch Push Notification to target recipients via server
 */
async function dispatchCallPushNotification(session: SchoolCallSession, targetUids: string[]) {
  if (!targetUids || targetUids.length === 0) return;

  const title = session.contextType === 'class_call'
    ? `🏫 ${session.contextTitle}`
    : session.type === 'video'
      ? `📹 Incoming Video Call from ${session.caller.name}`
      : `📞 Incoming Call from ${session.caller.name}`;

  const body = session.contextSubtitle || `${session.contextTitle} • Tap to join now.`;

  for (const uid of targetUids) {
    if (uid === session.caller.uid) continue;
    try {
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: session.callId,
          title,
          body,
          type: 'call',
          linkTab: 'peer_chat',
          tag: `call-${session.callId}`,
          targetUserId: uid,
          targetSchoolId: session.schoolId
        })
      }).catch(err => console.warn('[CallService] Push dispatch warning:', err));
    } catch (_) {}
  }
}

/**
 * Start a new School Context Call
 */
export async function startSchoolCall(params: {
  currentUser: UserProfile;
  effectiveRole?: string;
  type: 'audio' | 'video';
  contextType: CallContextType;
  contextTitle: string;
  contextSubtitle?: string;
  contextId?: string;
  targetParticipants: UserProfile[];
  schoolId?: string;
}): Promise<SchoolCallSession> {
  // Cleanup any previous session
  await endSchoolCall('new_call_initiated');

  const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const schoolId = params.schoolId || 'default_school';

  const caller: CallParticipant = {
    uid: params.currentUser.uid,
    name: params.currentUser.name || 'Faculty / Scholar',
    role: params.effectiveRole || params.currentUser.role || 'student',
    avatar: params.currentUser.avatar,
    email: params.currentUser.email,
    grade: params.currentUser.grade,
    section: params.currentUser.section,
    house: params.currentUser.house,
    status: 'connected',
    isMuted: false,
    isVideoOff: false,
    joinedAt: Date.now()
  };

  const initialParticipants: CallParticipant[] = [
    caller,
    ...params.targetParticipants
      .filter(u => u.uid && u.uid !== params.currentUser.uid)
      .map(u => ({
        uid: u.uid,
        name: u.name || 'Participant',
        role: u.role || 'student',
        avatar: u.avatar,
        email: u.email,
        grade: u.grade,
        section: u.section,
        house: u.house,
        status: 'ringing' as const,
        isMuted: false,
        isVideoOff: false
      }))
  ];

  const session: SchoolCallSession = {
    callId,
    caller,
    participants: initialParticipants,
    type: params.type,
    contextType: params.contextType,
    contextTitle: params.contextTitle,
    contextSubtitle: params.contextSubtitle,
    contextId: params.contextId,
    status: 'RINGING',
    createdAt: Date.now(),
    schoolId,
    isHost: true
  };

  // Acquire local media
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: params.type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
    });
    currentLocalStream = stream;
    caller.stream = stream;
  } catch (err) {
    console.warn('[CallService] Media device note:', err);
  }

  notifyCallState(session);
  soundService.playRingtone('outgoing');

  // Setup 35s unanswered expiry timeout
  callTimeoutTimer = setTimeout(() => {
    if (currentCallSession && currentCallSession.callId === callId && currentCallSession.status === 'RINGING') {
      const hasAccepted = currentCallSession.participants.some(p => p.uid !== caller.uid && p.status === 'connected');
      if (!hasAccepted) {
        endSchoolCall('timeout');
      }
    }
  }, 35000);

  // Setup subscriptions for incoming signals on this call
  setupCallSignaling(callId, params.currentUser.uid);

  // Broadcast Call Invite
  const invitePayload = {
    callId,
    session: {
      ...session,
      caller: { ...caller, stream: undefined },
      participants: initialParticipants.map(p => ({ ...p, stream: undefined }))
    },
    senderUid: params.currentUser.uid
  };

  // 1. Send on global broadcast & room channels
  sendRealtimeEvent(`call_room_${callId}`, 'call_invite', invitePayload);

  // 2. Send directly to each participant's personal channel
  const targetUids = params.targetParticipants.map(p => p.uid).filter(Boolean);
  targetUids.forEach(uid => {
    sendRealtimeEvent(`user_calls_${uid}`, 'call_invite', invitePayload);
  });

  // 3. Dispatch Server-Side Push Notification
  dispatchCallPushNotification(session, targetUids);

  return session;
}

/**
 * Accept an Incoming Call
 */
export async function acceptSchoolCall(callId?: string, currentUser?: UserProfile | null): Promise<boolean> {
  const targetId = callId || currentCallSession?.callId;
  if (!currentCallSession || (targetId && currentCallSession.callId !== targetId)) {
    console.warn('[CallService] Cannot accept call: session mismatch or missing.');
    return false;
  }

  soundService.stopRingtone();
  if (callTimeoutTimer) {
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = null;
  }

  // Acquire media if not already acquired
  if (!currentLocalStream) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: currentCallSession.type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      });
      currentLocalStream = stream;
    } catch (err) {
      console.warn('[CallService] Callee media access note:', err);
    }
  }

  const updatedParticipants = currentCallSession.participants.map(p =>
    p.uid === currentUser.uid ? { ...p, status: 'connected' as const, stream: currentLocalStream || undefined } : p
  );

  const updatedSession: SchoolCallSession = {
    ...currentCallSession,
    status: 'CONNECTED',
    acceptedAt: Date.now(),
    participants: updatedParticipants
  };

  notifyCallState(updatedSession);

  // Send acceptance signal
  const acceptPayload = {
    callId,
    responderUid: currentUser.uid,
    responderProfile: {
      uid: currentUser.uid,
      name: currentUser.name,
      role: currentUser.role,
      avatar: currentUser.avatar
    }
  };

  sendRealtimeEvent(`call_room_${callId}`, 'call_accepted', acceptPayload);
  sendRealtimeEvent(`user_calls_${currentCallSession.caller.uid}`, 'call_accepted', acceptPayload);

  // Initiate WebRTC peer negotiation with caller
  initiatePeerConnection(currentCallSession.caller.uid, false, callId);

  return true;
}

/**
 * Decline / Reject an Incoming Call
 */
export async function declineSchoolCall(callId?: string, reason: string = 'declined', currentUser?: UserProfile | null) {
  const targetId = callId || currentCallSession?.callId;
  soundService.stopRingtone();
  if (callTimeoutTimer) {
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = null;
  }

  if (currentCallSession && currentCallSession.callId === callId) {
    const payload = {
      callId,
      reason,
      declinedUid: currentUser?.uid
    };
    sendRealtimeEvent(`call_room_${callId}`, 'call_declined', payload);
    if (currentCallSession.caller?.uid) {
      sendRealtimeEvent(`user_calls_${currentCallSession.caller.uid}`, 'call_declined', payload);
    }
  }

  cleanupLocalCallState('DECLINED');
}

/**
 * End an Active Call
 */
export async function endSchoolCall(reason: string = 'normal_hangup') {
  soundService.stopRingtone();
  if (callTimeoutTimer) {
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = null;
  }

  if (currentCallSession) {
    const payload = {
      callId: currentCallSession.callId,
      reason,
      endedBy: currentCallSession.caller?.uid
    };
    sendRealtimeEvent(`call_room_${currentCallSession.callId}`, 'call_ended', payload);
    currentCallSession.participants.forEach(p => {
      sendRealtimeEvent(`user_calls_${p.uid}`, 'call_ended', payload);
    });
  }

  cleanupLocalCallState(reason === 'timeout' ? 'EXPIRED' : 'ENDED');
}

/**
 * Add / Invite a new participant to the active call
 */
export async function addParticipantToCall(participant: UserProfile) {
  if (!currentCallSession || !participant.uid) return;

  if (currentCallSession.participants.some(p => p.uid === participant.uid)) {
    return; // Already added
  }

  const newPart: CallParticipant = {
    uid: participant.uid,
    name: participant.name || 'Participant',
    role: participant.role || 'student',
    avatar: participant.avatar,
    email: participant.email,
    grade: participant.grade,
    section: participant.section,
    house: participant.house,
    status: 'ringing',
    isMuted: false,
    isVideoOff: false
  };

  const updatedSession: SchoolCallSession = {
    ...currentCallSession,
    participants: [...currentCallSession.participants, newPart]
  };

  notifyCallState(updatedSession);

  const invitePayload = {
    callId: currentCallSession.callId,
    session: {
      ...updatedSession,
      participants: updatedSession.participants.map(p => ({ ...p, stream: undefined }))
    },
    senderUid: currentCallSession.caller.uid
  };

  sendRealtimeEvent(`user_calls_${participant.uid}`, 'call_invite', invitePayload);
  sendRealtimeEvent(`call_room_${currentCallSession.callId}`, 'call_participant_added', { participant: newPart });
  dispatchCallPushNotification(updatedSession, [participant.uid]);
}

/**
 * Toggle Mic Mute
 */
export function toggleCallAudio(isMuted: boolean) {
  if (currentLocalStream) {
    currentLocalStream.getAudioTracks().forEach(t => {
      t.enabled = !isMuted;
    });
  }
  if (currentCallSession) {
    const updatedParticipants = currentCallSession.participants.map(p =>
      p.uid === currentCallSession!.caller.uid ? { ...p, isMuted } : p
    );
    notifyCallState({ ...currentCallSession, participants: updatedParticipants });
    sendRealtimeEvent(`call_room_${currentCallSession.callId}`, 'participant_media_change', {
      uid: currentCallSession.caller.uid,
      isMuted
    });
  }
}

/**
 * Toggle Video Camera
 */
export function toggleCallVideo(isVideoOff: boolean) {
  if (currentLocalStream) {
    currentLocalStream.getVideoTracks().forEach(t => {
      t.enabled = !isVideoOff;
    });
  }
  if (currentCallSession) {
    const updatedParticipants = currentCallSession.participants.map(p =>
      p.uid === currentCallSession!.caller.uid ? { ...p, isVideoOff } : p
    );
    notifyCallState({ ...currentCallSession, participants: updatedParticipants });
    sendRealtimeEvent(`call_room_${currentCallSession.callId}`, 'participant_media_change', {
      uid: currentCallSession.caller.uid,
      isVideoOff
    });
  }
}

/**
 * WebRTC Signaling Setup for a Call
 */
function setupCallSignaling(callId: string, currentUid: string) {
  currentUnsubscribers.forEach(unsub => {
    try { unsub(); } catch (_) {}
  });
  currentUnsubscribers = [];

  const unsubRoom = subscribeRealtimeEvents(`call_room_${callId}`, {
    call_accepted: (data: any) => {
      soundService.stopRingtone();
      if (!currentCallSession) return;
      const responderUid = data.responderUid;
      if (!responderUid || responderUid === currentUid) return;

      const updated = currentCallSession.participants.map(p =>
        p.uid === responderUid ? { ...p, status: 'connected' as const } : p
      );
      notifyCallState({
        ...currentCallSession,
        status: 'CONNECTED',
        acceptedAt: currentCallSession.acceptedAt || Date.now(),
        participants: updated
      });

      // Caller initiates WebRTC offer to the newly joined peer
      initiatePeerConnection(responderUid, true, callId);
    },
    call_declined: (data: any) => {
      if (!currentCallSession) return;
      const declinedUid = data.declinedUid;
      const updated = currentCallSession.participants.map(p =>
        p.uid === declinedUid ? { ...p, status: 'declined' as const } : p
      );
      const remainingActive = updated.filter(p => p.uid !== currentUid && (p.status === 'connected' || p.status === 'ringing'));
      if (remainingActive.length === 0) {
        endSchoolCall('all_declined');
      } else {
        notifyCallState({ ...currentCallSession, participants: updated });
      }
    },
    call_ended: () => {
      cleanupLocalCallState('ENDED');
    },
    webrtc_signal: async (data: any) => {
      if (!data || data.senderUid === currentUid) return;
      handleWebRTCSignal(data, callId, currentUid);
    },
    participant_media_change: (data: any) => {
      if (!currentCallSession || !data.uid) return;
      const updated = currentCallSession.participants.map(p => {
        if (p.uid === data.uid) {
          return {
            ...p,
            isMuted: data.isMuted !== undefined ? data.isMuted : p.isMuted,
            isVideoOff: data.isVideoOff !== undefined ? data.isVideoOff : p.isVideoOff
          };
        }
        return p;
      });
      notifyCallState({ ...currentCallSession, participants: updated });
    }
  });

  currentUnsubscribers.push(unsubRoom);
}

/**
 * Handle incoming WebRTC signals (Offers, Answers, ICE Candidates)
 */
async function handleWebRTCSignal(data: any, callId: string, currentUid: string) {
  const peerUid = data.senderUid;
  if (!peerUid || peerUid === currentUid) return;

  let pc = peerConnections.get(peerUid);
  if (!pc) {
    pc = createPeerConnection(peerUid, callId, currentUid);
  }

  try {
    if (data.offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendRealtimeEvent(`call_room_${callId}`, 'webrtc_signal', {
        answer: { type: answer.type, sdp: answer.sdp },
        senderUid: currentUid,
        targetUid: peerUid,
        callId
      });
    } else if (data.answer && (!data.targetUid || data.targetUid === currentUid)) {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    } else if (data.candidate && (!data.targetUid || data.targetUid === currentUid)) {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    }
  } catch (err) {
    console.warn('[CallService WebRTC] Signal error:', err);
  }
}

/**
 * Create a PeerConnection for a specific remote participant
 */
function createPeerConnection(peerUid: string, callId: string, currentUid: string): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  });

  if (currentLocalStream) {
    currentLocalStream.getTracks().forEach(track => {
      pc.addTrack(track, currentLocalStream!);
    });
  }

  pc.ontrack = (event) => {
    const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
    remoteStreams.set(peerUid, stream);

    if (currentCallSession) {
      const updated = currentCallSession.participants.map(p =>
        p.uid === peerUid ? { ...p, stream, status: 'connected' as const } : p
      );
      notifyCallState({ ...currentCallSession, participants: updated });
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendRealtimeEvent(`call_room_${callId}`, 'webrtc_signal', {
        candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        senderUid: currentUid,
        targetUid: peerUid,
        callId
      });
    }
  };

  peerConnections.set(peerUid, pc);
  return pc;
}

/**
 * Initiate peer connection as offerer
 */
async function initiatePeerConnection(peerUid: string, isOfferer: boolean, callId: string) {
  if (!currentCallSession) return;
  const currentUid = currentCallSession.caller.uid;
  const pc = createPeerConnection(peerUid, callId, currentUid);

  if (isOfferer) {
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: currentCallSession.type === 'video'
      });
      await pc.setLocalDescription(offer);
      sendRealtimeEvent(`call_room_${callId}`, 'webrtc_signal', {
        offer: { type: offer.type, sdp: offer.sdp },
        senderUid: currentUid,
        targetUid: peerUid,
        callId
      });
    } catch (err) {
      console.warn('[CallService] Create offer error:', err);
    }
  }
}

/**
 * Reset and Cleanup all local call state
 */
function cleanupLocalCallState(finalStatus: CallStatus) {
  soundService.stopRingtone();

  if (callTimeoutTimer) {
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = null;
  }

  // Stop local media tracks
  if (currentLocalStream) {
    currentLocalStream.getTracks().forEach(t => {
      try { t.stop(); } catch (_) {}
    });
    currentLocalStream = null;
  }

  // Close peer connections
  peerConnections.forEach(pc => {
    try { pc.close(); } catch (_) {}
  });
  peerConnections.clear();
  remoteStreams.clear();

  // Unsubscribe listeners
  currentUnsubscribers.forEach(unsub => {
    try { unsub(); } catch (_) {}
  });
  currentUnsubscribers = [];

  if (currentCallSession) {
    notifyCallState(null);
  }
}

/**
 * Global User Call Receiver Hook (Mounts at top-level App)
 */
export function setupGlobalCallReceiver(currentUser: UserProfile, onIncomingCall?: (session: SchoolCallSession) => void) {
  if (!currentUser?.uid) return () => {};

  const unsub = subscribeRealtimeEvents(`user_calls_${currentUser.uid}`, {
    call_invite: (data: any) => {
      if (!data || !data.session || data.senderUid === currentUser.uid) return;
      const incomingSession: SchoolCallSession = {
        ...data.session,
        isHost: false,
        status: 'RINGING'
      };

      notifyCallState(incomingSession);
      soundService.playRingtone('incoming');
      setupCallSignaling(incomingSession.callId, currentUser.uid);

      if (onIncomingCall) {
        onIncomingCall(incomingSession);
      }
    },
    call_ended: () => {
      cleanupLocalCallState('ENDED');
    },
    call_declined: () => {
      cleanupLocalCallState('DECLINED');
    }
  });

  return () => {
    unsub();
  };
}
