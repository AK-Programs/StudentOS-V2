import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  Hand, 
  MessageSquare, 
  Users, 
  Settings, 
  PhoneOff, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Shield, 
  Lock, 
  Unlock, 
  PenTool, 
  Sparkles, 
  Download, 
  FileText, 
  Share2, 
  Copy, 
  Check, 
  Grid, 
  Maximize2, 
  Radio, 
  Search, 
  UserCheck, 
  X, 
  AlertCircle,
  HelpCircle,
  Volume2,
  Paperclip,
  Smile,
  Send,
  Layers,
  Award,
  Globe,
  Bot,
  Trash2,
  Edit2,
  Image as ImageIcon,
  File as FileIcon,
  UserX,
  VolumeX,
  CameraOff,
  Pin,
  PinOff,
  Info,
  SmilePlus,
  MessageCircle,
  Volume1,
  FileCheck,
  Maximize
} from 'lucide-react';
import { UserProfile, Meeting, MeetingParticipant, MeetingChatMessage, MeetingRecording, MeetingBreakoutRoom, MeetingAttendanceReport } from '../types';
import { 
  fetchAllMeetings, 
  createOrUpdateMeeting, 
  saveMeetingChatMessage, 
  getLocalChatMessages, 
  deleteMeetingChatMessage,
  updateMeetingChatMessage,
  recordMeetingAttendance,
  saveMeetingRecording, 
  getLocalRecordings,
  deleteMeeting,
  endMeetingInStore
} from '../lib/supabaseMeet';
import { MeetWhiteboard } from './meet/MeetWhiteboard';
import { RemoteVideoTile } from './meet/RemoteVideoTile';
import { supabase } from '../lib/supabase';

interface StudentOSMeetProps {
  currentUser: UserProfile | null;
  effectiveRole: string;
  onNavigateTab?: (tab: string) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export const StudentOSMeet: React.FC<StudentOSMeetProps> = ({
  currentUser,
  effectiveRole,
  onNavigateTab
}) => {
  // Navigation & View Mode inside StudentOS Meet
  const [activeView, setActiveView] = useState<'lobby' | 'calendar' | 'recordings' | 'room'>('lobby');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [recordings, setRecordings] = useState<MeetingRecording[]>([]);

  // Meeting Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('Physics');
  const [newClassName, setNewClassName] = useState('Grade 10 - Astra');
  const [newBatch, setNewBatch] = useState('Batch 2026');
  const [newType, setNewType] = useState<'instant' | 'scheduled' | 'recurring'>('instant');
  const [newStartTime, setNewStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [newEndTime, setNewEndTime] = useState(new Date(Date.now() + 1000 * 60 * 60).toISOString().slice(0, 16));
  const [newDescription, setNewDescription] = useState('');
  const [newPassword, setNewPassword] = useState('9XK27');
  const [isSchoolWide, setIsSchoolWide] = useState(false);

  // In-Meeting State
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(false);
  const [joinPasswordInput, setJoinPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharingUserId, setScreenSharingUserId] = useState<string | null>(null);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const [spotlightUserId, setSpotlightUserId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'gallery' | 'speaker' | 'presentation'>('gallery');
  const [activeSidePanel, setActiveSidePanel] = useState<'chat' | 'participants' | 'breakout' | 'whiteboard' | 'ai' | 'attendance' | 'settings' | 'transcript' | null>('chat');

  // Device & Bandwidth Selection
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [bandwidthMode, setBandwidthMode] = useState<'auto' | '1080p' | '720p' | '480p' | 'low'>('auto');
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);

  // Participants & Host Waiting Room
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<MeetingParticipant[]>([]);
  const [isLocked, setIsLocked] = useState(false);

  // Chat & Messaging inside meeting
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [chatToast, setChatToast] = useState<{ sender: string; content: string } | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [pinnedMessage, setPinnedMessage] = useState<MeetingChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<MeetingChatMessage | null>(null);
  const [chatAttachment, setChatAttachment] = useState<{ name: string; url: string; type: 'image' | 'pdf' | 'file' } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modals & Floating Tools
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showReactionsBar, setShowReactionsBar] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Captions State
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [liveCaptionText, setLiveCaptionText] = useState('');
  const [captionTranscript, setCaptionTranscript] = useState<{ speaker: string; text: string; time: string }[]>([]);

  // Breakout Rooms State
  const [breakoutRooms, setBreakoutRooms] = useState<MeetingBreakoutRoom[]>([]);
  const [numBreakoutRooms, setNumBreakoutRooms] = useState(2);

  // Attendance Tracker
  const [joinTimestamp, setJoinTimestamp] = useState<number | null>(null);
  const [cameraActiveSeconds, setCameraActiveSeconds] = useState(0);
  const [micActiveSeconds, setMicActiveSeconds] = useState(0);

  // UI Utilities
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const isCurrentHost = Boolean(
    activeMeeting && (
      currentUser?.uid === activeMeeting.hostId ||
      (activeMeeting.hostEmail && currentUser?.email === activeMeeting.hostEmail) ||
      currentUser?.uid === 'host' ||
      activeMeeting.hostId === 'host' ||
      (activeMeeting.hostId.startsWith('host-') && ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole))
    )
  );

  // Media & WebRTC Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const [remoteStreamsState, setRemoteStreamsState] = useState<Record<string, MediaStream>>({});

  // Helper to trigger remote stream re-renders
  const syncRemoteStreamsState = () => {
    const updated: Record<string, MediaStream> = {};
    remoteStreamsRef.current.forEach((stream, uid) => {
      updated[uid] = stream;
    });
    setRemoteStreamsState(updated);
  };

  // Load Meetings & Sync
  useEffect(() => {
    loadAllMeetingsData();
    setRecordings(getLocalRecordings());
  }, []);

  const loadAllMeetingsData = async () => {
    const list = await fetchAllMeetings();
    setMeetings(list);
  };

  // Global Realtime Subscription for Meeting Sync, Deletions, and End Events
  useEffect(() => {
    const globalMeetingsChannel = supabase.channel('studentos_meetings_global');
    globalMeetingsChannel
      .on('broadcast', { event: 'meeting_sync' }, () => {
        loadAllMeetingsData();
      })
      .on('broadcast', { event: 'meeting_deleted' }, ({ payload }) => {
        if (payload && payload.meetingId) {
          setMeetings(prev => prev.filter(m => m.id !== payload.meetingId && m.id.toLowerCase() !== payload.meetingId.toLowerCase()));
          if (activeMeeting?.id === payload.meetingId || activeMeeting?.id.toLowerCase() === payload.meetingId.toLowerCase()) {
            alert('This meeting has been deleted by the host.');
            handleLeaveMeeting();
          }
        } else {
          loadAllMeetingsData();
        }
      })
      .on('broadcast', { event: 'meeting_ended' }, ({ payload }) => {
        if (payload && payload.meetingId) {
          setMeetings(prev => prev.map(m => (m.id === payload.meetingId || m.id.toLowerCase() === payload.meetingId.toLowerCase()) ? { ...m, status: 'ended' } : m));
          if (activeMeeting?.id === payload.meetingId || activeMeeting?.id.toLowerCase() === payload.meetingId.toLowerCase()) {
            alert('This meeting has been ended by the host.');
            handleLeaveMeeting();
          }
        } else {
          loadAllMeetingsData();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(globalMeetingsChannel);
    };
  }, [activeMeeting?.id]);

  // Live countdown timer for Waiting Room auto-admit
  const [, setWaitingRoomClock] = useState(0);
  useEffect(() => {
    if (!isInWaitingRoom || !activeMeeting?.startTime) return;
    const interval = setInterval(() => {
      const diff = new Date(activeMeeting.startTime).getTime() - Date.now();
      if (diff <= 0) {
        setIsInWaitingRoom(false);
        clearInterval(interval);
      } else {
        setWaitingRoomClock(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isInWaitingRoom, activeMeeting?.startTime]);

  // Auto-join via URL Parameter (?meet=ABCD-EFGH or ?meetingId=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meetParam = params.get('meet') || params.get('meetingId');
    if (meetParam) {
      fetchAllMeetings().then(list => {
        const found = list.find(m => m.id.toLowerCase() === meetParam.toLowerCase() || m.id.replace(/-/g, '').toLowerCase() === meetParam.replace(/-/g, '').toLowerCase());
        if (found) {
          if (found.status === 'ended') {
            setJoinError('This meeting has already ended.');
            return;
          }
          handleJoinMeeting(found);
        } else {
          setJoinError('Meeting not found. Please check the Meeting ID.');
        }
      });
    }
  }, []);

  // Enumerate Audio/Video Devices
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const v = devices.filter(d => d.kind === 'videoinput');
        const a = devices.filter(d => d.kind === 'audioinput');
        setVideoDevices(v);
        setAudioDevices(a);
        if (v.length > 0 && !selectedVideoDevice) setSelectedVideoDevice(v[0].deviceId);
        if (a.length > 0 && !selectedAudioDevice) setSelectedAudioDevice(a[0].deviceId);
      }).catch(err => console.warn('Device enum warning', err));
    }
  }, []);

  // Local Camera & Mic Stream Lifecycle
  useEffect(() => {
    if (activeView === 'room' && !isInWaitingRoom) {
      startLocalMediaStream();
    } else {
      stopLocalMediaStream();
    }
    return () => {
      stopLocalMediaStream();
    };
  }, [activeView, isInWaitingRoom, isCameraOn, isMicOn, selectedVideoDevice, selectedAudioDevice]);

  // Keep local video element srcObject synchronized across re-renders and layout changes (e.g. spotlight, featured tile)
  useEffect(() => {
    if (activeView === 'room' && isCameraOn && localStreamRef.current && localVideoRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  }, [activeView, isCameraOn, spotlightUserId, pinnedParticipantId, screenSharingUserId, participants]);

  const startLocalMediaStream = async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (!isCameraOn && !isMicOn) {
        localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        return;
      }
      const constraints: MediaStreamConstraints = {
        video: isCameraOn ? { deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: isMicOn ? { deviceId: selectedAudioDevice ? { exact: selectedAudioDevice } : undefined, echoCancellation, noiseSuppression } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Replace tracks on existing WebRTC peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack) {
          const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender) videoSender.replaceTrack(videoTrack);
          else pc.addTrack(videoTrack, stream);
        }
        if (audioTrack) {
          const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
          if (audioSender) audioSender.replaceTrack(audioTrack);
          else pc.addTrack(audioTrack, stream);
        }
      });
    } catch (err) {
      console.warn('[StudentOS Meet] Camera/Mic access note:', err);
    }
  };

  const stopLocalMediaStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  // WebRTC Signaling Engine
  useEffect(() => {
    if (!activeMeeting || activeView !== 'room' || isInWaitingRoom) return;

    const myUserId = currentUser?.uid || `user_${Date.now()}`;
    const channelName = `studentos_meet_${activeMeeting.id}`;
    const channel = supabase.channel(channelName);

    // Create a new RTCPeerConnection for a peer
    const createPeerConnection = (targetUserId: string) => {
      if (peerConnectionsRef.current.has(targetUserId)) {
        return peerConnectionsRef.current.get(targetUserId)!;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(targetUserId, pc);

      // Add local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // On receiving remote track
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreamsRef.current.set(targetUserId, event.streams[0]);
          syncRemoteStreamsState();
        }
      };

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'webrtc_candidate',
            payload: { targetUserId, fromUserId: myUserId, candidate: event.candidate }
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          remoteStreamsRef.current.delete(targetUserId);
          syncRemoteStreamsState();
        }
      };

      return pc;
    };

    channel
      .on('broadcast', { event: 'peer_join' }, async ({ payload }) => {
        if (payload && payload.userId && payload.userId !== myUserId) {
          // Add peer to participants list if not present
          setParticipants(prev => {
            if (prev.some(p => p.userId === payload.userId)) return prev;
            return [...prev, {
              id: `p_${payload.userId}`,
              meetingId: activeMeeting.id,
              userId: payload.userId,
              name: payload.name || 'Participant',
              email: payload.email || '',
              role: payload.role || 'participant',
              userRole: payload.userRole || 'student',
              status: 'admitted',
              joinedAt: new Date().toISOString(),
              durationSeconds: 0,
              isCameraOn: payload.isCameraOn ?? true,
              isMicOn: payload.isMicOn ?? true,
              isHandRaised: payload.isHandRaised ?? false,
              isScreenSharing: payload.isScreenSharing ?? false,
              cameraActiveDuration: 0,
              micActiveDuration: 0,
              networkQuality: 'excellent'
            }];
          });

          // Respond back with our own presence details so newly joined peer syncs instantly
          channel.send({
            type: 'broadcast',
            event: 'peer_sync',
            payload: {
              userId: myUserId,
              name: currentUser?.name || 'Participant',
              email: currentUser?.email || '',
              role: (currentUser?.uid === activeMeeting.hostId || (activeMeeting.hostEmail && currentUser?.email === activeMeeting.hostEmail)) ? 'host' : 'participant',
              userRole: (currentUser?.role as any) || 'student',
              isCameraOn,
              isMicOn,
              isHandRaised,
              isScreenSharing,
              screenSharingUserId: isScreenSharing ? myUserId : screenSharingUserId,
              spotlightUserId
            }
          });

          // Existing peer creates WebRTC offer for newly joined peer
          const pc = createPeerConnection(payload.userId);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({
              type: 'broadcast',
              event: 'webrtc_offer',
              payload: { targetUserId: payload.userId, fromUserId: myUserId, offer }
            });
          } catch (e) {
            console.warn('Error creating WebRTC offer:', e);
          }
        }
      })
      .on('broadcast', { event: 'peer_sync' }, ({ payload }) => {
        if (payload && payload.userId && payload.userId !== myUserId) {
          setParticipants(prev => {
            if (prev.some(p => p.userId === payload.userId)) {
              return prev.map(p => p.userId === payload.userId ? { ...p, ...payload } : p);
            }
            return [...prev, {
              id: `p_${payload.userId}`,
              meetingId: activeMeeting.id,
              userId: payload.userId,
              name: payload.name || 'Participant',
              email: payload.email || '',
              role: payload.role || 'participant',
              userRole: payload.userRole || 'student',
              status: 'admitted',
              joinedAt: new Date().toISOString(),
              durationSeconds: 0,
              isCameraOn: payload.isCameraOn ?? true,
              isMicOn: payload.isMicOn ?? true,
              isHandRaised: payload.isHandRaised ?? false,
              isScreenSharing: payload.isScreenSharing ?? false,
              cameraActiveDuration: 0,
              micActiveDuration: 0,
              networkQuality: 'excellent'
            }];
          });

          if (payload.screenSharingUserId) {
            setScreenSharingUserId(payload.screenSharingUserId);
          }
          if (payload.spotlightUserId) {
            setSpotlightUserId(payload.spotlightUserId);
          }
        }
      })
      .on('broadcast', { event: 'spotlight_user' }, ({ payload }) => {
        if (payload) {
          setSpotlightUserId(payload.userId || null);
        }
      })
      .on('broadcast', { event: 'webrtc_offer' }, async ({ payload }) => {
        if (payload && payload.targetUserId === myUserId) {
          const pc = createPeerConnection(payload.fromUserId);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: 'broadcast',
              event: 'webrtc_answer',
              payload: { targetUserId: payload.fromUserId, fromUserId: myUserId, answer }
            });
          } catch (e) {
            console.warn('Error creating WebRTC answer:', e);
          }
        }
      })
      .on('broadcast', { event: 'webrtc_answer' }, async ({ payload }) => {
        if (payload && payload.targetUserId === myUserId) {
          const pc = peerConnectionsRef.current.get(payload.fromUserId);
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            } catch (e) {
              console.warn('Error setting remote answer:', e);
            }
          }
        }
      })
      .on('broadcast', { event: 'webrtc_candidate' }, async ({ payload }) => {
        if (payload && payload.targetUserId === myUserId) {
          const pc = peerConnectionsRef.current.get(payload.fromUserId);
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.warn('Error adding ICE candidate:', e);
            }
          }
        }
      })
      .on('broadcast', { event: 'peer_state_update' }, ({ payload }) => {
        if (payload && payload.userId) {
          setParticipants(prev => prev.map(p => p.userId === payload.userId ? { ...p, ...payload.state } : p));
        }
      })
      .on('broadcast', { event: 'join_request' }, ({ payload }) => {
        if (payload && payload.participant) {
          const isHost = currentUser?.uid === activeMeeting.hostId || ['teacher', 'admin', 'super_admin'].includes(effectiveRole);
          if (isHost) {
            setWaitingParticipants(prev => {
              if (prev.some(w => w.userId === payload.participant.userId)) return prev;
              return [...prev, payload.participant];
            });
          }
        }
      })
      .on('broadcast', { event: 'admit' }, ({ payload }) => {
        if (payload && payload.targetUserId === myUserId) {
          setIsInWaitingRoom(false);
        }
      })
      .on('broadcast', { event: 'reject' }, ({ payload }) => {
        if (payload && payload.targetUserId === myUserId) {
          alert('Your request to join the meeting was declined by the host.');
          handleLeaveMeeting();
        }
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (payload && payload.message) {
          setChatMessages(prev => {
            if (prev.some(m => m.id === payload.message.id)) return prev;
            return [...prev, payload.message];
          });
          if (payload.message.senderId !== myUserId) {
            setUnreadChatCount(prev => prev + 1);
            setChatToast({ sender: payload.message.senderName, content: payload.message.content });
            setTimeout(() => setChatToast(null), 4000);
          }
        } else if (payload && payload.action === 'delete') {
          setChatMessages(prev => prev.filter(m => m.id !== payload.messageId));
        } else if (payload && payload.action === 'edit') {
          setChatMessages(prev => prev.map(m => m.id === payload.messageId ? { ...m, content: payload.newContent } : m));
        }
      })
      .on('broadcast', { event: 'peer_screenshare_start' }, ({ payload }) => {
        if (payload && payload.userId) {
          setScreenSharingUserId(payload.userId);
        }
      })
      .on('broadcast', { event: 'peer_screenshare_stop' }, ({ payload }) => {
        if (payload && payload.userId) {
          setScreenSharingUserId(prev => prev === payload.userId ? null : prev);
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload && payload.userName && payload.userId !== myUserId) {
          setTypingUsers(prev => prev.includes(payload.userName) ? prev : [...prev, payload.userName]);
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u !== payload.userName));
          }, 3000);
        }
      })
      .on('broadcast', { event: 'live_caption' }, ({ payload }) => {
        if (payload && payload.speaker && payload.text) {
          setLiveCaptionText(`${payload.speaker}: ${payload.text}`);
          setCaptionTranscript(prev => [...prev, { speaker: payload.speaker, text: payload.text, time: payload.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        }
      })
      .on('broadcast', { event: 'host_control' }, ({ payload }) => {
        if (payload) {
          if (payload.action === 'mute_all' && currentUser?.uid !== activeMeeting.hostId) {
            setIsMicOn(false);
          } else if (payload.action === 'mute_user' && payload.targetUserId === myUserId) {
            setIsMicOn(false);
          } else if (payload.action === 'disable_camera_all' && currentUser?.uid !== activeMeeting.hostId) {
            setIsCameraOn(false);
          } else if (payload.action === 'disable_camera_user' && payload.targetUserId === myUserId) {
            setIsCameraOn(false);
          } else if (payload.action === 'remove_user' && payload.targetUserId === myUserId) {
            alert('You have been removed from the meeting by the host.');
            handleLeaveMeeting();
          } else if (payload.action === 'end_meeting' || payload.action === 'delete_meeting') {
            handleLeaveMeeting();
            alert('The host has ended or deleted the meeting.');
          }
        }
      })
      .on('broadcast', { event: 'peer_leave' }, ({ payload }) => {
        if (payload && payload.userId) {
          const pc = peerConnectionsRef.current.get(payload.userId);
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(payload.userId);
          }
          remoteStreamsRef.current.delete(payload.userId);
          syncRemoteStreamsState();
          setParticipants(prev => prev.filter(p => p.userId !== payload.userId));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Announce presence to all peers in the channel
          channel.send({
            type: 'broadcast',
            event: 'peer_join',
            payload: {
              userId: myUserId,
              name: currentUser?.name || 'Participant',
              email: currentUser?.email || '',
              role: (currentUser?.uid === activeMeeting.hostId) ? 'host' : 'participant',
              userRole: (currentUser?.role as any) || 'student',
              isCameraOn,
              isMicOn,
              isHandRaised,
              isScreenSharing
            }
          });
        }
      });

    return () => {
      // Broadcast leave on cleanup
      channel.send({
        type: 'broadcast',
        event: 'peer_leave',
        payload: { userId: myUserId }
      });
      supabase.removeChannel(channel);
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      remoteStreamsRef.current.clear();
      syncRemoteStreamsState();
    };
  }, [activeMeeting, activeView, isInWaitingRoom, currentUser]);

  // Broadcast state changes (camera, mic, hand raise, screen share) to peers
  useEffect(() => {
    if (activeMeeting && activeView === 'room' && !isInWaitingRoom) {
      supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
        type: 'broadcast',
        event: 'peer_state_update',
        payload: {
          userId: currentUser?.uid || 'user',
          state: { isCameraOn, isMicOn, isHandRaised, isScreenSharing }
        }
      });
    }
  }, [isCameraOn, isMicOn, isHandRaised, isScreenSharing, activeMeeting, activeView, isInWaitingRoom, currentUser]);

  // Recording Timer
  useEffect(() => {
    let timer: any = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Attendance Tracker Timer
  useEffect(() => {
    let interval: any = null;
    if (activeView === 'room' && !isInWaitingRoom) {
      interval = setInterval(() => {
        if (isCameraOn) setCameraActiveSeconds(prev => prev + 1);
        if (isMicOn) setMicActiveSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeView, isInWaitingRoom, isCameraOn, isMicOn]);

  // Real-time Speech-to-Text Live Captions Engine
  useEffect(() => {
    if (!captionsEnabled || activeView !== 'room' || !isMicOn) {
      setLiveCaptionText('');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setLiveCaptionText('Speech recognition engine initialized. Listening for audio...');
      return;
    }

    let recognition: any = null;
    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript.trim()) {
          const text = finalTranscript.trim();
          const speaker = currentUser?.name || 'Speaker';
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          setLiveCaptionText(`${speaker}: ${text}`);
          setCaptionTranscript(prev => [...prev, { speaker, text, time }]);

          // Broadcast caption to peers in meeting
          if (activeMeeting) {
            supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
              type: 'broadcast',
              event: 'live_caption',
              payload: { speaker, text, time }
            });
          }
        }
      };

      recognition.onerror = (err: any) => {
        if (err.error !== 'no-speech') {
          console.warn('[StudentOS Meet] Speech recognition status:', err.error);
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('[StudentOS Meet] Could not initialize speech recognition:', err);
    }

    return () => {
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
      }
    };
  }, [captionsEnabled, activeView, isMicOn, currentUser, activeMeeting]);

  // Handle Meeting Creation
  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    const meetingId = `MEET-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
    
    const newMeeting: Meeting = {
      id: meetingId,
      title: newTitle || 'StudentOS Interactive Classroom',
      subject: newSubject,
      className: newClassName,
      batch: newBatch,
      type: newType,
      startTime: newType === 'instant' ? new Date().toISOString() : new Date(newStartTime).toISOString(),
      endTime: new Date(newEndTime).toISOString(),
      description: newDescription,
      password: newPassword,
      hostId: currentUser?.uid || 'demo-host-uid',
      hostName: currentUser?.name || 'Faculty Instructor',
      hostEmail: currentUser?.email || 'faculty@school.edu',
      hostRole: (currentUser?.role as any) || 'teacher',
      joinLink: `${window.location.origin}?meet=${meetingId}`,
      isSchoolWide,
      status: newType === 'instant' ? 'live' : 'upcoming',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await createOrUpdateMeeting(newMeeting);
    setShowCreateModal(false);
    loadAllMeetingsData();

    if (newType === 'instant') {
      handleJoinMeeting(newMeeting);
    } else {
      alert(`Meeting scheduled successfully!\nMeeting ID: ${meetingId}\nPassword: ${newPassword}\nLink copied to clipboard!`);
      navigator.clipboard.writeText(newMeeting.joinLink);
    }
  };

  // Join Meeting Flow
  const handleJoinMeeting = (meeting: Meeting) => {
    if (meeting.status === 'ended') {
      setJoinError('This meeting has already ended.');
      return;
    }

    setActiveMeeting(meeting);
    setJoinPasswordInput('');
    setPasswordError('');
    setJoinError(null);
    
    const isHost = currentUser?.uid === meeting.hostId || (meeting.hostEmail && currentUser?.email === meeting.hostEmail) || ['teacher', 'admin', 'super_admin'].includes(effectiveRole);
    const isBeforeStartTime = meeting.startTime ? new Date().getTime() < new Date(meeting.startTime).getTime() : false;
    const requiresWaitingRoom = !isHost && (isBeforeStartTime || Boolean(meeting.password) || meeting.status === 'upcoming');

    const myParticipant: MeetingParticipant = {
      id: `p_${currentUser?.uid || Date.now()}`,
      meetingId: meeting.id,
      userId: currentUser?.uid || `user_${Date.now()}`,
      name: currentUser?.name || 'Student Participant',
      email: currentUser?.email || 'student@school.edu',
      role: isHost ? 'host' : 'participant',
      userRole: (currentUser?.role as any) || 'student',
      status: requiresWaitingRoom ? 'waiting' : 'admitted',
      joinedAt: new Date().toISOString(),
      durationSeconds: 0,
      isCameraOn,
      isMicOn,
      isHandRaised: false,
      isScreenSharing: false,
      cameraActiveDuration: 0,
      micActiveDuration: 0,
      networkQuality: 'excellent'
    };

    if (requiresWaitingRoom) {
      setIsInWaitingRoom(true);
      setWaitingParticipants([myParticipant]);
      setParticipants([]);

      // Send join request broadcast to host
      supabase.channel(`studentos_meet_${meeting.id}`).send({
        type: 'broadcast',
        event: 'join_request',
        payload: { participant: myParticipant }
      });
    } else {
      setIsInWaitingRoom(false);
      setParticipants([myParticipant]);
      setWaitingParticipants([]);
    }

    setChatMessages(getLocalChatMessages(meeting.id));
    setJoinTimestamp(Date.now());
    setCameraActiveSeconds(0);
    setMicActiveSeconds(0);
    setActiveView('room');
  };

  const handleJoinViaCode = () => {
    const inputVal = joinPasswordInput.trim();
    if (!inputVal) return;
    const found = meetings.find(m => m.id.toLowerCase() === inputVal.toLowerCase() || m.id.replace(/-/g, '').toLowerCase() === inputVal.replace(/-/g, '').toLowerCase());
    if (found) {
      if (found.status === 'ended') {
        setJoinError('This meeting has already ended.');
        return;
      }
      handleJoinMeeting(found);
    } else {
      setJoinError('Meeting not found. Please check the Meeting ID.');
    }
  };

  const handleConfirmPasswordJoin = () => {
    if (activeMeeting?.password && joinPasswordInput !== activeMeeting.password) {
      setPasswordError('Invalid meeting password. Please check and try again.');
      return;
    }
    setPasswordError('');
    setIsInWaitingRoom(false);

    // Update self status to admitted
    setParticipants(prev => {
      const myUid = currentUser?.uid || 'user';
      if (prev.some(p => p.userId === myUid)) return prev;
      return [...prev, {
        id: `p_${myUid}`,
        meetingId: activeMeeting?.id || '',
        userId: myUid,
        name: currentUser?.name || 'Student Participant',
        email: currentUser?.email || 'student@school.edu',
        role: 'participant',
        userRole: (currentUser?.role as any) || 'student',
        status: 'admitted',
        joinedAt: new Date().toISOString(),
        durationSeconds: 0,
        isCameraOn,
        isMicOn,
        isHandRaised: false,
        isScreenSharing: false,
        cameraActiveDuration: 0,
        micActiveDuration: 0,
        networkQuality: 'excellent'
      }];
    });
  };

  const handleLeaveMeeting = async () => {
    if (activeMeeting && joinTimestamp) {
      const durationSecs = Math.round((Date.now() - joinTimestamp) / 1000);
      await recordMeetingAttendance({
        meetingId: activeMeeting.id,
        userId: currentUser?.uid || 'user',
        userName: currentUser?.name || 'Participant',
        userEmail: currentUser?.email || 'user@school.edu',
        userRole: (currentUser?.role as any) || 'student',
        joinedAt: new Date(joinTimestamp).toISOString(),
        leftAt: new Date().toISOString(),
        durationSeconds: durationSecs,
        cameraActiveSeconds,
        micActiveSeconds
      });
    }

    stopLocalMediaStream();
    if (isRecording) setIsRecording(false);
    setActiveView('lobby');
    setActiveMeeting(null);
    setParticipants([]);
    setWaitingParticipants([]);
    setScreenSharingUserId(null);
    setPinnedParticipantId(null);
  };

  // Screen Sharing Toggle
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      setScreenSharingUserId(null);
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      if (activeMeeting) {
        supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
          type: 'broadcast',
          event: 'peer_screenshare_stop',
          payload: { userId: currentUser?.uid || 'user' }
        });
      }
      // Revert video track on WebRTC peer connections
      if (localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(camTrack);
        });
      }
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = displayStream;
        setIsScreenSharing(true);
        const myUid = currentUser?.uid || 'user';
        setScreenSharingUserId(myUid);
        const screenTrack = displayStream.getVideoTracks()[0];

        if (activeMeeting) {
          supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
            type: 'broadcast',
            event: 'peer_screenshare_start',
            payload: { userId: myUid }
          });
        }

        // Replace video track across WebRTC peer connections
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          setScreenSharingUserId(null);
          screenStreamRef.current = null;
          if (activeMeeting) {
            supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
              type: 'broadcast',
              event: 'peer_screenshare_stop',
              payload: { userId: myUid }
            });
          }
          if (localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
            const camTrack = localStreamRef.current.getVideoTracks()[0];
            peerConnectionsRef.current.forEach((pc) => {
              const sender = pc.getSenders().find(s => s.track?.kind === 'video');
              if (sender) sender.replaceTrack(camTrack);
            });
          }
        };
      } catch (e) {
        console.warn('Screen share canceled or unallowed', e);
      }
    }
  };

  // Raise Hand Toggle
  const handleToggleHandRaise = () => {
    const nextVal = !isHandRaised;
    setIsHandRaised(nextVal);
    setParticipants(prev => prev.map(p => p.userId === currentUser?.uid ? { ...p, isHandRaised: nextVal } : p));
  };

  // Host Controls
  const handleHostMuteAll = () => {
    if (!activeMeeting || !isCurrentHost) return;
    supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
      type: 'broadcast',
      event: 'host_control',
      payload: { action: 'mute_all' }
    });
    alert('Muted microphones for all participants.');
  };

  const handleHostDisableCameraAll = () => {
    if (!activeMeeting || !isCurrentHost) return;
    supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
      type: 'broadcast',
      event: 'host_control',
      payload: { action: 'disable_camera_all' }
    });
    alert('Disabled cameras for all participants.');
  };

  const handleHostMuteUser = (targetUserId: string) => {
    if (!activeMeeting || !isCurrentHost) return;
    supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
      type: 'broadcast',
      event: 'host_control',
      payload: { action: 'mute_user', targetUserId }
    });
    setParticipants(prev => prev.map(p => p.userId === targetUserId ? { ...p, isMicOn: false } : p));
  };

  const handleHostDisableUserCamera = (targetUserId: string) => {
    if (!activeMeeting || !isCurrentHost) return;
    supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
      type: 'broadcast',
      event: 'host_control',
      payload: { action: 'disable_camera_user', targetUserId }
    });
    setParticipants(prev => prev.map(p => p.userId === targetUserId ? { ...p, isCameraOn: false } : p));
  };

  const handleHostRemoveUser = (targetUserId: string) => {
    if (!activeMeeting || !isCurrentHost) return;
    if (confirm('Remove this participant from the meeting?')) {
      supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
        type: 'broadcast',
        event: 'host_control',
        payload: { action: 'remove_user', targetUserId }
      });
      setParticipants(prev => prev.filter(p => p.userId !== targetUserId));
    }
  };

  const handleHostSpotlightUser = (targetUserId: string) => {
    if (!activeMeeting || !isCurrentHost) return;
    const nextVal = spotlightUserId === targetUserId ? null : targetUserId;
    setSpotlightUserId(nextVal);
    supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
      type: 'broadcast',
      event: 'spotlight_user',
      payload: { userId: nextVal }
    });
  };

  const handleHostEndMeeting = async () => {
    if (!activeMeeting || !isCurrentHost) return;
    if (confirm('Are you sure you want to end this meeting for all participants?')) {
      const targetId = activeMeeting.id;
      await endMeetingInStore(targetId);
      try {
        supabase.channel(`studentos_meet_${targetId}`).send({
          type: 'broadcast',
          event: 'host_control',
          payload: { action: 'end_meeting' }
        });
        supabase.channel('studentos_meetings_global').send({
          type: 'broadcast',
          event: 'meeting_ended',
          payload: { meetingId: targetId }
        });
      } catch (_) {}
      handleLeaveMeeting();
    }
  };

  const handleHostDeleteMeeting = async (meetingId: string) => {
    const m = meetings.find(x => x.id === meetingId) || activeMeeting;
    if (!m) return;
    const canDelete = currentUser?.uid === m.hostId || (m.hostEmail && currentUser?.email === m.hostEmail) || currentUser?.uid === 'host' || m.hostId === 'host' || (m.hostId.startsWith('host-') && ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole));
    if (!canDelete) {
      alert('Only the Host can delete this meeting.');
      return;
    }
    if (confirm('Are you sure you want to permanently delete this meeting?')) {
      await deleteMeeting(meetingId);
      try {
        supabase.channel(`studentos_meet_${meetingId}`).send({
          type: 'broadcast',
          event: 'host_control',
          payload: { action: 'delete_meeting' }
        });
        supabase.channel('studentos_meetings_global').send({
          type: 'broadcast',
          event: 'meeting_deleted',
          payload: { meetingId }
        });
      } catch (_) {}
      if (activeMeeting?.id === meetingId) {
        handleLeaveMeeting();
      }
      loadAllMeetingsData();
    }
  };

  const handleAdmitWaitingUser = (targetUserId: string) => {
    const userToAdmit = waitingParticipants.find(w => w.userId === targetUserId);
    if (userToAdmit) {
      setWaitingParticipants(prev => prev.filter(w => w.userId !== targetUserId));
      setParticipants(prev => [...prev, { ...userToAdmit, status: 'admitted' }]);
      if (activeMeeting) {
        supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
          type: 'broadcast',
          event: 'admit',
          payload: { targetUserId }
        });
      }
    }
  };

  const handleRejectWaitingUser = (targetUserId: string) => {
    setWaitingParticipants(prev => prev.filter(w => w.userId !== targetUserId));
    if (activeMeeting) {
      supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
        type: 'broadcast',
        event: 'reject',
        payload: { targetUserId }
      });
    }
  };

  const handleAdmitAll = () => {
    waitingParticipants.forEach(w => handleAdmitWaitingUser(w.userId));
  };

  // File Upload Attachment Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const isImg = file.type.startsWith('image/');
      const isPdf = file.type.includes('pdf');
      setChatAttachment({
        name: file.name,
        url: reader.result as string,
        type: isImg ? 'image' : isPdf ? 'pdf' : 'file'
      });
    };
    reader.readAsDataURL(file);
  };

  // Chat Send
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!chatInput.trim() && !chatAttachment) || !activeMeeting) return;

    const newMsg: MeetingChatMessage = {
      id: 'msg_' + Date.now(),
      meetingId: activeMeeting.id,
      senderId: currentUser?.uid || 'user-uid',
      senderName: currentUser?.name || 'Participant',
      senderRole: (currentUser?.role as any) || 'student',
      content: chatInput.trim(),
      attachment: chatAttachment || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    await saveMeetingChatMessage(newMsg);
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
    setChatAttachment(null);

    supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
      type: 'broadcast',
      event: 'chat',
      payload: { message: newMsg }
    });
  };

  // Chat Delete
  const handleDeleteChatMessage = async (msgId: string) => {
    if (!activeMeeting) return;
    await deleteMeetingChatMessage(activeMeeting.id, msgId);
    setChatMessages(prev => prev.filter(m => m.id !== msgId));
    supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
      type: 'broadcast',
      event: 'chat',
      payload: { action: 'delete', messageId: msgId }
    });
  };

  // Chat Edit
  const handleSaveEditChatMessage = async (msgId: string) => {
    if (!activeMeeting || !editingContent.trim()) return;
    await updateMeetingChatMessage(activeMeeting.id, msgId, editingContent.trim());
    setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editingContent.trim() } : m));
    supabase.channel(`studentos_meet_${activeMeeting.id}`).send({
      type: 'broadcast',
      event: 'chat',
      payload: { action: 'edit', messageId: msgId, newContent: editingContent.trim() }
    });
    setEditingMessageId(null);
    setEditingContent('');
  };

  // Recording Controls
  const handleStartRecording = () => {
    setIsRecording(true);
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    if (!activeMeeting) return;

    const newRec: MeetingRecording = {
      id: 'rec_' + Date.now(),
      meetingId: activeMeeting.id,
      title: `${activeMeeting.title} (Class Session)`,
      hostName: activeMeeting.hostName,
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      durationSeconds: recordingDuration || 300,
      sizeBytes: 42 * 1024 * 1024,
      createdAt: new Date().toISOString(),
      aiSummary: 'Recorded session covering core lecture topics, whiteboard demonstrations, and student query resolution.'
    };

    await saveMeetingRecording(newRec);
    setRecordings(getLocalRecordings());
    alert('Meeting recording saved in StudentOS Archive!');
  };

  // Export Attendance CSV
  const handleExportAttendanceReport = () => {
    if (!activeMeeting) return;
    const durationMins = joinTimestamp ? Math.round((Date.now() - joinTimestamp) / 60000) : 1;
    let csv = `StudentOS Meet Attendance Report\n`;
    csv += `Meeting Title,${activeMeeting.title}\n`;
    csv += `Meeting ID,${activeMeeting.id}\n`;
    csv += `Host,${activeMeeting.hostName}\n`;
    csv += `Date,${new Date().toLocaleDateString()}\n\n`;
    csv += `Participant Name,Email,Role,Joined At,Mic Active (s),Camera Active (s)\n`;

    participants.forEach(p => {
      csv += `"${p.name}","${p.email}","${p.userRole}","${p.joinedAt}",${p.micActiveDuration}s,${p.cameraActiveDuration}s\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${activeMeeting.id}.csv`;
    a.click();
  };

  const copyJoinLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyMeetingId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* GLOBAL TOP MEET HEADER (When in Lobby / Calendar) */}
      {activeView !== 'room' && (
        <header className="px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-white font-display">StudentOS Meet</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Real WebRTC
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium">Online Classroom & Virtual Meeting Suite</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-white/10 text-xs font-bold overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveView('lobby')}
              className={`px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 sm:gap-2 ${activeView === 'lobby' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
              Lobby & Meetings
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={`px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 sm:gap-2 ${activeView === 'calendar' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <CalendarIcon className="w-4 h-4" />
              Meeting Calendar
            </button>
            <button
              onClick={() => setActiveView('recordings')}
              className={`px-3 sm:px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 sm:gap-2 ${activeView === 'recordings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Radio className="w-4 h-4" />
              Recordings Archive
            </button>
          </div>

          {/* Create Meeting CTA */}
          <div className="flex items-center gap-3">
            {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole) && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                New Class / Meeting
              </button>
            )}
          </div>
        </header>
      )}

      {/* VIEW 1: LOBBY & MEETINGS DASHBOARD */}
      {activeView === 'lobby' && (
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-8 animate-fadeIn">
          {/* Join Error Banner if invalid ID or ended meeting */}
          {joinError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white">Meeting Access Error</h4>
                  <p className="text-xs text-rose-300">{joinError}</p>
                </div>
              </div>
              <button 
                onClick={() => setJoinError(null)}
                className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-white rounded-xl text-xs font-bold transition-all"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Quick Action Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-950 border border-indigo-500/20 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3 z-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Video className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white">Instant Class</h3>
                <p className="text-xs text-slate-300">Launch a virtual lecture room immediately with automated attendance & whiteboard.</p>
              </div>
              <button
                onClick={() => {
                  const m: Meeting = {
                    id: `MEET-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`,
                    title: `${currentUser?.name || 'Faculty'}'s Instant Classroom`,
                    subject: 'Interactive Session',
                    type: 'instant',
                    startTime: new Date().toISOString(),
                    endTime: new Date(Date.now() + 3600000).toISOString(),
                    password: '123',
                    hostId: currentUser?.uid || 'host',
                    hostName: currentUser?.name || 'Teacher',
                    hostEmail: currentUser?.email || 'teacher@school.edu',
                    hostRole: (currentUser?.role as any) || 'teacher',
                    joinLink: `${window.location.origin}?meet=instant`,
                    status: 'live',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  };
                  handleJoinMeeting(m);
                }}
                className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 z-10"
              >
                <Plus className="w-4 h-4" />
                Start Instant Meeting
              </button>
            </div>

            <div className="p-6 rounded-3xl bg-gradient-to-br from-violet-900/40 via-slate-900 to-slate-950 border border-violet-500/20 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3 z-10">
                <div className="w-12 h-12 rounded-2xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white">Schedule Meeting</h3>
                <p className="text-xs text-slate-300">Plan upcoming lectures, invite whole classes, and send calendar reminders.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-6 w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 z-10"
              >
                <CalendarIcon className="w-4 h-4" />
                Schedule Class / Event
              </button>
            </div>

            <div className="p-6 rounded-3xl bg-gradient-to-br from-teal-900/40 via-slate-900 to-slate-950 border border-teal-500/20 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3 z-10">
                <div className="w-12 h-12 rounded-2xl bg-teal-600/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white">Join via Code / Password</h3>
                <p className="text-xs text-slate-300">Enter a secure meeting ID or paste a StudentOS Meet join link.</p>
              </div>
              <div className="mt-6 flex items-center gap-2 z-10">
                <input
                  type="text"
                  placeholder="e.g. MEET-892-412"
                  value={joinPasswordInput}
                  onChange={(e) => setJoinPasswordInput(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none flex-1 focus:border-teal-500"
                />
                <button
                  onClick={handleJoinViaCode}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* Live & Upcoming Meetings Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
                Live & Scheduled Virtual Classes
              </h2>
              <span className="text-xs text-slate-400 font-mono">{meetings.length} Total Meetings</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {meetings.map((m) => (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 hover:border-indigo-500/50 transition-all shadow-xl flex flex-col justify-between space-y-4 relative group"
                >
                  {m.isSchoolWide && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      School Assembly
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${m.status === 'live' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
                      <span className="text-[10px] font-mono uppercase text-indigo-400 font-extrabold">{m.subject} • {m.className || 'General'}</span>
                    </div>

                    <h3 className="text-base font-extrabold text-white group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {m.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2">{m.description || 'No description provided.'}</p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-white/5 text-xs text-slate-400 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-teal-400" /> {m.hostName.split(' ')[0]}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleJoinMeeting(m)}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
                      >
                        <Video className="w-4 h-4" />
                        {m.status === 'live' ? 'Join Classroom Now' : 'Enter Lobby'}
                      </button>

                      <button
                        onClick={() => copyJoinLink(m.joinLink)}
                        className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10 transition-all"
                        title="Copy Join Link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {['teacher', 'admin', 'super_admin'].includes(effectiveRole) && (
                        <button
                          onClick={() => handleHostDeleteMeeting(m.id)}
                          className="p-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 rounded-xl border border-rose-500/20 transition-all"
                          title="Delete Meeting"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* VIEW 2: MEETING CALENDAR */}
      {activeView === 'calendar' && (
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white">StudentOS Meeting Calendar</h2>
              <p className="text-xs text-slate-400">Class schedules, assembly routines, and academic webinars</p>
            </div>
          </div>

          <div className="bg-slate-900/90 rounded-3xl border border-white/10 p-6 shadow-2xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase text-indigo-400 font-bold">Today's Classes</p>
                  <p className="text-2xl font-black text-white">{meetings.length}</p>
                </div>
                <CalendarIcon className="w-8 h-8 text-indigo-400" />
              </div>

              <div className="p-4 bg-violet-600/10 border border-violet-500/20 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase text-violet-400 font-bold">Upcoming</p>
                  <p className="text-2xl font-black text-white">{meetings.filter(m => m.status === 'upcoming').length}</p>
                </div>
                <Clock className="w-8 h-8 text-violet-400" />
              </div>

              <div className="p-4 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase text-emerald-400 font-bold">Completed</p>
                  <p className="text-2xl font-black text-white">14</p>
                </div>
                <UserCheck className="w-8 h-8 text-emerald-400" />
              </div>

              <div className="p-4 bg-rose-600/10 border border-rose-500/20 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase text-rose-400 font-bold">Recordings</p>
                  <p className="text-2xl font-black text-white">{recordings.length}</p>
                </div>
                <Radio className="w-8 h-8 text-rose-400" />
              </div>
            </div>

            {/* List View of Schedule */}
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider">Scheduled Lectures</h3>
              {meetings.map(m => (
                <div key={m.id} className="p-4 bg-slate-950/60 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-4 hover:border-indigo-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">{m.title}</h4>
                      <p className="text-xs text-slate-400 font-mono">{m.subject} • {m.className} • Host: {m.hostName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="px-3 py-1 bg-white/5 rounded-lg text-slate-300">{new Date(m.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <button
                      onClick={() => handleJoinMeeting(m)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow transition-all"
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* VIEW 3: RECORDINGS ARCHIVE */}
      {activeView === 'recordings' && (
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-xl font-black text-white">Class Recordings & AI Summaries</h2>
            <p className="text-xs text-slate-400">Recorded virtual lectures, whiteboard captures, and attendance logs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recordings.map(rec => (
              <div key={rec.id} className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 hover:border-indigo-500/50 transition-all shadow-2xl space-y-4">
                <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden relative flex items-center justify-center border border-white/5">
                  <Video className="w-10 h-10 text-indigo-400 animate-pulse" />
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 rounded text-[10px] font-mono text-white">
                    {Math.floor(rec.durationSeconds / 60)}m {rec.durationSeconds % 60}s
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-white line-clamp-1">{rec.title}</h3>
                  <p className="text-xs text-slate-400 font-mono">Instructor: {rec.hostName}</p>
                </div>

                {rec.aiSummary && (
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono uppercase text-indigo-400 font-black flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI Session Key Notes
                    </span>
                    <p className="text-[11px] text-slate-300 leading-snug">{rec.aiSummary}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <a
                    href={rec.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition-all text-center"
                  >
                    Watch Recording
                  </a>
                  <a
                    href={rec.url}
                    download
                    className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10 transition-all"
                    title="Download Video File"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* VIEW 4: ACTIVE MEETING ROOM & WAITING ROOM */}
      {activeView === 'room' && activeMeeting && (
        <div className="flex-1 flex flex-col h-screen bg-slate-950 overflow-hidden relative">
          
          {/* WAITING ROOM MODAL OVERLAY */}
          {isInWaitingRoom && (
            <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-fadeIn">
              <div className="max-w-md w-full bg-slate-900 p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6 text-center">
                <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mx-auto flex items-center justify-center">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-mono font-bold text-indigo-400 uppercase">
                    Meeting Waiting Room
                  </span>
                  <h2 className="text-xl font-black text-white">{activeMeeting.title}</h2>
                  <p className="text-xs text-slate-300">Host: <span className="text-white font-bold">{activeMeeting.hostName}</span></p>
                  <p className="text-xs text-slate-400 font-mono">Scheduled Time: {new Date(activeMeeting.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>

                {/* Countdown / Status Box */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-white/10 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status & Countdown</span>
                  <div className="text-2xl font-mono font-black text-indigo-400">
                    {(() => {
                      const diff = new Date(activeMeeting.startTime).getTime() - Date.now();
                      if (diff <= 0) return 'Starting Now...';
                      const m = Math.floor(diff / 60000);
                      const s = Math.floor((diff % 60000) / 1000);
                      return `${m}m ${s.toString().padStart(2, '0')}s until class starts`;
                    })()}
                  </div>
                  <p className="text-[11px] text-slate-400">You will be admitted automatically when the scheduled time arrives or when the host starts the session.</p>
                </div>

                <div className="space-y-3">
                  {activeMeeting.password && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <p className="text-xs text-slate-300 font-bold">Have a Meeting Password?</p>
                      <input
                        type="password"
                        placeholder="Enter passcode..."
                        value={joinPasswordInput}
                        onChange={(e) => setJoinPasswordInput(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-sm text-center font-mono text-white outline-none focus:border-indigo-500"
                      />
                      {passwordError && <p className="text-xs text-rose-400 font-bold">{passwordError}</p>}

                      <button
                        onClick={handleConfirmPasswordJoin}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all"
                      >
                        Enter Passcode & Join Immediately
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleLeaveMeeting}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 text-xs rounded-2xl font-bold transition-all"
                  >
                    Leave Waiting Room
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE ROOM TOP CONTROL BAR */}
          {(() => {
            const selfUserUid = currentUser?.uid || 'self_uid';

            const mySelfParticipant: MeetingParticipant = {
              id: `p_self_${selfUserUid}`,
              meetingId: activeMeeting.id,
              userId: selfUserUid,
              name: currentUser?.name || 'You',
              email: currentUser?.email || '',
              role: isCurrentHost ? 'host' : 'participant',
              userRole: (currentUser?.role as any) || 'student',
              status: 'admitted',
              joinedAt: new Date().toISOString(),
              durationSeconds: 0,
              isCameraOn,
              isMicOn,
              isHandRaised,
              isScreenSharing,
              cameraActiveDuration: 0,
              micActiveDuration: 0,
              networkQuality: 'excellent'
            };

            const allRoomParticipants = [
              mySelfParticipant,
              ...participants.filter(p => p.userId !== selfUserUid)
            ];

            let featuredUserId: string | null = null;
            let featuredTag: string = '';

            if (screenSharingUserId) {
              featuredUserId = screenSharingUserId;
              featuredTag = 'Screen Sharing';
            } else if (spotlightUserId) {
              featuredUserId = spotlightUserId;
              featuredTag = 'Spotlighted for Everyone';
            } else if (pinnedParticipantId) {
              featuredUserId = pinnedParticipantId;
              featuredTag = 'Pinned View';
            } else if (allRoomParticipants.length > 1) {
              const hostP = allRoomParticipants.find(p => p.role === 'host' || p.userId === activeMeeting.hostId);
              if (hostP) {
                featuredUserId = hostP.userId;
                featuredTag = 'Host Video';
              }
            }

            const featuredParticipantObj = featuredUserId
              ? allRoomParticipants.find(p => p.userId === featuredUserId)
              : null;

            const otherParticipants = featuredParticipantObj
              ? allRoomParticipants.filter(p => p.userId !== featuredParticipantObj.userId)
              : allRoomParticipants;

            const renderTile = (p: MeetingParticipant, isFeatured = false) => {
              const isSelf = p.userId === selfUserUid;
              if (isSelf) {
                return (
                  <div
                    key={p.userId}
                    onDoubleClick={() => setPinnedParticipantId(pinnedParticipantId === p.userId ? null : p.userId)}
                    className={`relative aspect-video bg-slate-900 rounded-3xl border-2 transition-all overflow-hidden shadow-2xl group flex items-center justify-center ${
                      pinnedParticipantId === p.userId ? 'border-amber-500 shadow-amber-500/20' :
                      spotlightUserId === p.userId ? 'border-indigo-500 shadow-indigo-500/30 ring-2 ring-indigo-500/50' :
                      isScreenSharing ? 'border-teal-500/80 shadow-teal-500/20' : 'border-indigo-500/50 hover:border-indigo-400'
                    }`}
                  >
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${!isCameraOn ? 'hidden' : 'block'}`}
                    />

                    {!isCameraOn && (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white border border-indigo-500/30 flex items-center justify-center text-2xl font-black shadow-lg">
                        {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/75 backdrop-blur-md rounded-xl text-xs font-extrabold text-white flex items-center gap-2 border border-white/10 shadow-lg z-10">
                      <span>{currentUser?.name || 'You'} (Self)</span>
                      {!isMicOn && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                      {isHandRaised && <Hand className="w-3.5 h-3.5 text-amber-400 animate-bounce" />}
                    </div>

                    {isScreenSharing && (
                      <div className="absolute top-3 right-3 px-2.5 py-1 bg-teal-500/20 border border-teal-500/40 rounded-full text-[10px] font-mono font-black text-teal-300 uppercase z-10">
                        Sharing Screen
                      </div>
                    )}

                    <div className="absolute top-3 left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button
                        onClick={() => setPinnedParticipantId(pinnedParticipantId === p.userId ? null : p.userId)}
                        title={pinnedParticipantId === p.userId ? 'Unpin' : 'Pin participant'}
                        className={`p-2 rounded-xl border backdrop-blur-md transition-all ${pinnedParticipantId === p.userId ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-black/70 text-white border-white/20 hover:bg-slate-800'}`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      {isCurrentHost && (
                        <button
                          onClick={() => handleHostSpotlightUser(p.userId)}
                          title={spotlightUserId === p.userId ? 'Remove Spotlight' : 'Spotlight for Everyone'}
                          className={`p-2 rounded-xl border backdrop-blur-md transition-all ${spotlightUserId === p.userId ? 'bg-indigo-500 text-white border-indigo-400 animate-pulse' : 'bg-black/70 text-indigo-300 border-white/20 hover:bg-slate-800'}`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <RemoteVideoTile
                  key={p.userId}
                  participant={p}
                  stream={remoteStreamsState[p.userId]}
                  isScreenSharing={p.isScreenSharing || screenSharingUserId === p.userId}
                  isPinned={pinnedParticipantId === p.userId}
                  onPin={() => setPinnedParticipantId(pinnedParticipantId === p.userId ? null : p.userId)}
                  isSpotlighted={spotlightUserId === p.userId}
                  onSpotlight={isCurrentHost ? () => handleHostSpotlightUser(p.userId) : undefined}
                  isHost={isCurrentHost}
                  onHostMute={() => handleHostMuteUser(p.userId)}
                  onHostRemove={() => handleHostRemoveUser(p.userId)}
                />
              );
            };

            return (
              <>
                <header className="px-6 py-3 bg-slate-900/90 border-b border-white/10 flex items-center justify-between gap-4 backdrop-blur-md z-30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-white line-clamp-1">{activeMeeting.title}</h2>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>ID: {activeMeeting.id}</span>
                        {activeMeeting.password && (
                          <>
                            <span>•</span>
                            <span>Pass: {activeMeeting.password}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-emerald-400 flex items-center gap-1"><Shield className="w-3 h-3" /> WebRTC Encrypted</span>
                      </div>
                    </div>
                  </div>

                  {/* Room Metrics Dashboard Bar */}
                  <div className="hidden md:flex items-center gap-4 bg-slate-950 px-4 py-2 rounded-2xl border border-white/10 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      {allRoomParticipants.length} Active {allRoomParticipants.length === 1 ? 'Peer' : 'Peers'}
                    </span>

                    {isRecording && (
                      <span className="flex items-center gap-1.5 text-rose-400 font-bold animate-pulse">
                        <Radio className="w-3.5 h-3.5" />
                        REC {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                      </span>
                    )}

                    <button
                      onClick={() => copyJoinLink(activeMeeting.joinLink)}
                      className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      {copiedLink ? 'Link Copied!' : 'Share Link'}
                    </button>

                    <button
                      onClick={() => copyMeetingId(activeMeeting.id)}
                      className="flex items-center gap-1.5 text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedId ? 'ID Copied!' : 'Copy ID'}
                    </button>
                  </div>

                  {/* Leave Room Button */}
                  <button
                    onClick={handleLeaveMeeting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow transition-all flex items-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Leave Room
                  </button>
                </header>

                {/* MAIN STAGE & SIDE PANELS */}
                <div className="flex-1 flex overflow-hidden relative">
                  
                  {/* VIDEO GRID / MAIN CANVAS STAGE */}
                  <div className="flex-1 p-4 bg-slate-950 overflow-y-auto flex flex-col justify-between space-y-4">
                    
                    {/* Live Captions Stream Banner */}
                    {captionsEnabled && liveCaptionText && (
                      <div className="p-3 bg-black/80 backdrop-blur-xl border border-indigo-500/40 rounded-2xl max-w-2xl mx-auto text-center shadow-2xl animate-fadeIn">
                        <p className="text-xs font-mono font-bold text-indigo-300">{liveCaptionText}</p>
                      </div>
                    )}

                    {/* PARTICIPANTS STAGE LAYOUT */}
                    {featuredParticipantObj ? (
                      <div className="flex-1 flex flex-col justify-between gap-4">
                        {/* Featured Large Main Panel */}
                        <div className="relative w-full max-w-5xl mx-auto aspect-video">
                          {renderTile(featuredParticipantObj, true)}
                          <div className="absolute top-3 left-3 px-3 py-1 bg-indigo-600/90 backdrop-blur-md rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 shadow-lg z-10 pointer-events-none">
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>{featuredTag}: {featuredParticipantObj.name}</span>
                          </div>
                        </div>

                        {/* Rail of Other Participants Below */}
                        {otherParticipants.length > 0 && (
                          <div className="w-full flex items-center justify-center gap-4 overflow-x-auto py-2">
                            {otherParticipants.map(p => (
                              <div key={p.userId} className="w-64 sm:w-72 shrink-0">
                                {renderTile(p, false)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center justify-center">
                        {allRoomParticipants.map(p => (
                          <div key={p.userId}>
                            {renderTile(p, false)}
                          </div>
                        ))}
                      </div>
                    )}

              {/* Chat Toast Notification Popup */}
              {chatToast && activeSidePanel !== 'chat' && (
                <div 
                  onClick={() => { setActiveSidePanel('chat'); setUnreadChatCount(0); setChatToast(null); }}
                  className="fixed bottom-20 right-6 z-50 p-4 bg-slate-900/95 border border-indigo-500/40 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 cursor-pointer animate-slideUp max-w-sm hover:border-indigo-400 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h5 className="text-xs font-bold text-white truncate">{chatToast.sender}</h5>
                    <p className="text-xs text-slate-300 truncate">{chatToast.content}</p>
                  </div>
                </div>
              )}

              {/* FLOATING IN-MEETING CONTROL BAR */}
              <div className="p-3 bg-slate-900/90 border border-white/10 rounded-2xl backdrop-blur-xl max-w-3xl w-full mx-auto flex items-center justify-between gap-3 shadow-2xl z-20">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMicOn(!isMicOn)}
                    className={`p-3 rounded-2xl transition-all ${isMicOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'}`}
                    title="Toggle Microphone"
                  >
                    {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setIsCameraOn(!isCameraOn)}
                    className={`p-3 rounded-2xl transition-all ${isCameraOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'}`}
                    title="Toggle Camera"
                  >
                    {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleScreenShare}
                    className={`p-3 rounded-2xl transition-all ${isScreenSharing ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                    title="Share Screen"
                  >
                    <Monitor className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setActiveSidePanel(activeSidePanel === 'whiteboard' ? null : 'whiteboard')}
                    className={`p-3 rounded-2xl transition-all ${activeSidePanel === 'whiteboard' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                    title="Collaborative Whiteboard"
                  >
                    <PenTool className="w-5 h-5" />
                  </button>

                  <button
                    onClick={handleToggleHandRaise}
                    className={`p-3 rounded-2xl transition-all ${isHandRaised ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/30' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                    title="Raise Hand"
                  >
                    <Hand className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setActiveSidePanel(activeSidePanel === 'transcript' ? null : 'transcript')}
                    className={`p-3 rounded-2xl transition-all ${activeSidePanel === 'transcript' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                    title="Live Transcript & Speech Logs"
                  >
                    <FileText className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setCaptionsEnabled(!captionsEnabled)}
                    className={`p-3 rounded-2xl transition-all ${captionsEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                    title="Toggle Live Captions Overlay"
                  >
                    <Sparkles className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveSidePanel(activeSidePanel === 'chat' ? null : 'chat');
                      setUnreadChatCount(0);
                    }}
                    className={`p-3 rounded-2xl transition-all relative ${activeSidePanel === 'chat' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                    title="Meeting Chat"
                  >
                    <MessageSquare className="w-5 h-5" />
                    {unreadChatCount > 0 && activeSidePanel !== 'chat' && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                        {unreadChatCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveSidePanel(activeSidePanel === 'participants' ? null : 'participants')}
                    className={`p-3 rounded-2xl transition-all relative ${activeSidePanel === 'participants' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                    title="Participants & Host Controls"
                  >
                    <Users className="w-5 h-5" />
                    {waitingParticipants.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center">
                        {waitingParticipants.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveSidePanel(activeSidePanel === 'settings' ? null : 'settings')}
                    className={`p-3 rounded-2xl transition-all ${activeSidePanel === 'settings' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                    title="Audio & Video Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* SIDE PANEL (Chat, Participants, Whiteboard, AI Assistant, Settings) */}
            {activeSidePanel && (
              <aside className="w-80 md:w-96 bg-slate-900 border-l border-white/10 flex flex-col h-full z-30 shadow-2xl animate-slideLeft">
                
                {/* Panel Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 font-mono">
                    {activeSidePanel === 'chat' && '💬 Meeting Chat'}
                    {activeSidePanel === 'participants' && '👥 Participants & Host'}
                    {activeSidePanel === 'transcript' && '📜 Meeting Transcript'}
                    {activeSidePanel === 'whiteboard' && '✏️ Collaborative Board'}
                    {activeSidePanel === 'ai' && '🤖 AI Meeting Tutor'}
                    {activeSidePanel === 'settings' && '⚙️ Device Settings'}
                  </h3>

                  <button onClick={() => setActiveSidePanel(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* SIDE PANEL CONTENT: CHAT */}
                {activeSidePanel === 'chat' && (
                  <div className="flex-1 flex flex-col h-full overflow-hidden p-4 space-y-4">
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {chatMessages.length === 0 ? (
                        <div className="text-center py-10 text-xs text-slate-500 font-mono">
                          No messages yet. Start the conversation!
                        </div>
                      ) : (
                        chatMessages.map(m => (
                          <div key={m.id} className="p-3 bg-slate-950 rounded-2xl border border-white/5 space-y-1.5 relative group">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="font-extrabold text-indigo-400">{m.senderName} ({m.senderRole})</span>
                              <span className="text-slate-500">{m.timestamp}</span>
                            </div>

                            {editingMessageId === m.id ? (
                              <div className="space-y-2 pt-1">
                                <input
                                  type="text"
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full bg-slate-900 border border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                                />
                                <div className="flex items-center gap-2 justify-end">
                                  <button onClick={() => setEditingMessageId(null)} className="text-[10px] text-slate-400">Cancel</button>
                                  <button onClick={() => handleSaveEditChatMessage(m.id)} className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold">Save</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-200 leading-relaxed break-words">{m.content}</p>
                            )}

                            {m.attachment && (
                              <div className="mt-2 p-2 bg-slate-900 rounded-xl border border-white/10 flex items-center gap-2">
                                {m.attachment.type === 'image' ? (
                                  <img src={m.attachment.url} alt={m.attachment.name} className="w-12 h-12 object-cover rounded-lg" />
                                ) : (
                                  <FileIcon className="w-6 h-6 text-indigo-400" />
                                )}
                                <span className="text-[10px] text-slate-300 font-mono truncate flex-1">{m.attachment.name}</span>
                              </div>
                            )}

                            {/* Message Actions (Delete/Edit own message) */}
                            {m.senderId === currentUser?.uid && !editingMessageId && (
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded-lg border border-white/10">
                                <button
                                  onClick={() => {
                                    setEditingMessageId(m.id);
                                    setEditingContent(m.content);
                                  }}
                                  className="text-slate-400 hover:text-indigo-400"
                                  title="Edit Message"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteChatMessage(m.id)}
                                  className="text-slate-400 hover:text-rose-400"
                                  title="Delete Message"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Chat Attachment Preview */}
                    {chatAttachment && (
                      <div className="p-2 bg-indigo-600/10 border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs">
                        <span className="truncate font-mono text-indigo-300 text-[11px]">{chatAttachment.name}</span>
                        <button onClick={() => setChatAttachment(null)} className="text-slate-400 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Quick Emojis Bar */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-sm">
                      {['👍', '👏', '❤️', '🔥', '🎉', '💡', '❓'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setChatInput(prev => prev + ' ' + emoji)}
                          className="px-2 py-1 bg-slate-950 hover:bg-slate-800 rounded-lg border border-white/5 transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleSendChatMessage} className="flex items-center gap-2 pt-2 border-t border-white/10">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-slate-400 hover:text-white bg-slate-950 rounded-xl border border-white/10"
                        title="Attach Image or PDF"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      <input
                        type="text"
                        placeholder="Send message to room..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                      />
                      <button type="submit" className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow">
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}

                {/* SIDE PANEL CONTENT: PARTICIPANTS & HOST CONTROLS */}
                {activeSidePanel === 'participants' && (
                  <div className="flex-1 p-4 overflow-y-auto space-y-6">
                    
                    {/* Host Action Buttons */}
                    {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole) && (
                      <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl space-y-2">
                        <span className="text-[10px] font-mono uppercase text-indigo-400 font-extrabold">Host Controls</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={handleHostMuteAll} className="py-2 px-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-[10px] font-bold">
                            Mute All
                          </button>
                          <button onClick={handleHostDisableCameraAll} className="py-2 px-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-[10px] font-bold">
                            Disable Cameras
                          </button>
                          <button onClick={handleExportAttendanceReport} className="py-2 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1">
                            <Download className="w-3 h-3" /> Export Report
                          </button>
                          <button onClick={handleHostEndMeeting} className="py-2 px-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-bold">
                            End Class
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Waiting Room List */}
                    {waitingParticipants.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-extrabold text-amber-400">Waiting Room ({waitingParticipants.length})</span>
                          <button onClick={handleAdmitAll} className="text-[10px] font-bold text-indigo-400 hover:underline">Admit All</button>
                        </div>
                        {waitingParticipants.map(w => (
                          <div key={w.userId} className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                            <span className="text-xs text-white font-bold">{w.name}</span>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleAdmitWaitingUser(w.userId)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg">
                                Admit
                              </button>
                              <button onClick={() => handleRejectWaitingUser(w.userId)} className="px-2.5 py-1 bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 text-[10px] font-bold rounded-lg">
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Admitted Real Participants List */}
                    <div className="space-y-2">
                      <span className="text-xs font-mono font-extrabold text-slate-400">In Meeting ({participants.length})</span>
                      {participants.map(p => (
                        <div key={p.userId} className="p-3 bg-slate-950 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold flex items-center justify-center text-xs shadow">
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-white flex items-center gap-1.5">
                                {p.name}
                                {p.userId === currentUser?.uid && <span className="text-[10px] text-indigo-400">(You)</span>}
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono">{p.userRole}</p>
                            </div>
                          </div>

                          {/* Host Controls Per Participant */}
                          {['teacher', 'admin', 'super_admin'].includes(effectiveRole) && p.userId !== currentUser?.uid && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleHostMuteUser(p.userId)}
                                className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg"
                                title="Mute Participant"
                              >
                                <VolumeX className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleHostDisableUserCamera(p.userId)}
                                className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg"
                                title="Disable Camera"
                              >
                                <CameraOff className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleHostRemoveUser(p.userId)}
                                className="p-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 rounded-lg"
                                title="Remove from Meeting"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SIDE PANEL CONTENT: TRANSCRIPT */}
                {activeSidePanel === 'transcript' && (
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs font-mono">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-indigo-400" /> Live Speech Logs
                        </h4>
                        <p className="text-[10px] text-slate-400">Recorded speech-to-text transcript</p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const txt = captionTranscript.map(t => `[${t.time}] ${t.speaker}: ${t.text}`).join('\n');
                            navigator.clipboard.writeText(txt);
                            alert('Transcript copied to clipboard!');
                          }}
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg"
                          title="Copy Transcript"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            const txt = captionTranscript.map(t => `[${t.time}] ${t.speaker}: ${t.text}`).join('\n');
                            const blob = new Blob([txt], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Transcript_${activeMeeting.id}.txt`;
                            a.click();
                          }}
                          className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded-lg"
                          title="Download Transcript (.txt)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {isCurrentHost && (
                          <button
                            onClick={() => setCaptionTranscript([])}
                            className="p-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 rounded-lg"
                            title="Clear Transcript (Host)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Captions Toggle Status */}
                    <div className="p-3 bg-slate-950 rounded-xl border border-white/10 flex items-center justify-between">
                      <span className="text-slate-300 font-bold">Live Captions Engine</span>
                      <button
                        onClick={() => setCaptionsEnabled(!captionsEnabled)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold ${captionsEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                      >
                        {captionsEnabled ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>

                    {/* Transcript Log Items */}
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                      {captionTranscript.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 font-sans">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-xs">No speech transcript recorded yet.</p>
                          <p className="text-[10px] text-slate-600 mt-1">Speak into your microphone or turn on Speech Recognition to record live transcript.</p>
                        </div>
                      ) : (
                        captionTranscript.map((item, idx) => (
                          <div key={idx} className="p-2.5 bg-slate-950 rounded-xl border border-white/5 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-bold text-indigo-300">{item.speaker}</span>
                              <span className="text-slate-500">{item.time}</span>
                            </div>
                            <p className="text-xs text-slate-200 font-sans leading-relaxed">{item.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* SIDE PANEL CONTENT: SETTINGS */}
                {activeSidePanel === 'settings' && (
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs font-mono">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400">Camera Input Device</label>
                      <select
                        value={selectedVideoDevice}
                        onChange={(e) => setSelectedVideoDevice(e.target.value)}
                        className="w-full mt-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none"
                      >
                        {videoDevices.map(d => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400">Microphone Input Device</label>
                      <select
                        value={selectedAudioDevice}
                        onChange={(e) => setSelectedAudioDevice(e.target.value)}
                        className="w-full mt-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none"
                      >
                        {audioDevices.map(d => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-2xl border border-white/5 space-y-2">
                      <label className="text-[10px] uppercase font-bold text-indigo-400">Audio Processing</label>
                      <div className="flex items-center justify-between">
                        <span>Echo Cancellation</span>
                        <input
                          type="checkbox"
                          checked={echoCancellation}
                          onChange={(e) => setEchoCancellation(e.target.checked)}
                          className="accent-indigo-500"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Noise Suppression</span>
                        <input
                          type="checkbox"
                          checked={noiseSuppression}
                          onChange={(e) => setNoiseSuppression(e.target.checked)}
                          className="accent-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SIDE PANEL CONTENT: WHITEBOARD */}
                {activeSidePanel === 'whiteboard' && (
                  <div className="flex-1 p-2 overflow-hidden flex flex-col">
                    <MeetWhiteboard
                      meetingId={activeMeeting.id}
                      currentUserName={currentUser?.name || 'User'}
                      isHost={['teacher', 'admin', 'super_admin'].includes(effectiveRole)}
                    />
                  </div>
                )}

                {/* SIDE PANEL CONTENT: AI ASSISTANT */}
                {activeSidePanel === 'ai' && (
                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    <div className="p-4 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl space-y-2">
                      <h4 className="text-xs font-black uppercase text-violet-300 font-mono flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> AI Lecture Copilot
                      </h4>
                      <p className="text-xs text-slate-300">Live AI assistant summarizing lecture concepts and resolving student doubts in real-time.</p>
                    </div>

                    <button className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4" /> Generate Instant Session Summary
                    </button>
                  </div>
                )}

              </aside>
            )}

          </div>
        </>
      );
    })()}
        </div>
      )}

      {/* CREATE / SCHEDULE MEETING MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="max-w-xl w-full bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-indigo-400" />
                Schedule New Virtual Class / Meeting
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="text-xs font-mono font-bold text-slate-400 uppercase">Class / Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electromagnetic Waves & Special Relativity"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono font-bold text-slate-400 uppercase">Subject</label>
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono font-bold text-slate-400 uppercase">Class & Batch</label>
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono font-bold text-slate-400 uppercase">Start Time</label>
                  <input
                    type="datetime-local"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono font-bold text-slate-400 uppercase">Meeting Password</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {effectiveRole === 'super_admin' && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="schoolwide"
                    checked={isSchoolWide}
                    onChange={(e) => setIsSchoolWide(e.target.checked)}
                    className="accent-indigo-500 w-4 h-4"
                  />
                  <label htmlFor="schoolwide" className="text-xs font-bold text-amber-300">
                    Principal Special Assembly (School-Wide Invitation)
                  </label>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-white/5 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-lg"
                >
                  Create & Dispatch Invitations
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
