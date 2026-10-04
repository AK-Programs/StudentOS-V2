import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Image as ImageIcon, Paperclip, Mic, MicOff, Square, Smile, Reply, Forward, 
  Trash2, Edit3, Pin, Shield, QrCode, UserPlus, LogOut, Settings, X, Search, 
  CheckCheck, Check, Volume2, VolumeX, Video, VideoOff, Phone, PhoneOff, PhoneIncoming, PhoneOutgoing,
  AlertTriangle, Info, Sparkles, Filter, Bell, Copy, Link, Eye, UserCheck, Flame, ThumbsUp, Heart,
  Trophy, Megaphone, BookOpen, Users, Hash, MoreHorizontal, ArrowLeft, Monitor, User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { ChatMessage, ChatRoom, UserRole, HouseType, ChatAttachment, UserProfile } from '../types';
import { moderateChatMessage } from '../lib/aiModeration';
import { 
  savePeerMessage, deletePeerMessage, saveChatRoom, joinChatRoom, leaveChatRoom, 
  deleteChatRoom, regenerateRoomCode, getPeerMessages, getAllUserProfiles, getOrCreateDirectMessageRoom 
} from '../lib/supabaseChat';
import { saveAppNotification } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { presenceService, UserPresence } from '../lib/presenceService';
import { soundService } from '../lib/soundService';
import { PublicProfileModal } from './PublicProfileModal';
import { getVerificationStatus } from '../lib/verification';

interface ChatSystemProps {
  currentUser: UserProfile | null;
  effectiveRole: UserRole;
  chatRooms: ChatRoom[];
  setChatRooms: React.Dispatch<React.SetStateAction<ChatRoom[]>>;
  chats: ChatMessage[];
  setChats: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  activeChatTargetId: string;
  setActiveChatTargetId: (id: string) => void;
  showNotification: (msg: string) => void;
  students?: UserProfile[];
  activeTab?: string;
}

interface ActiveCall {
  callId: string;
  targetUser: UserProfile;
  type: 'audio' | 'video';
  mode: 'outgoing' | 'incoming' | 'connected';
  startTime?: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isCaller?: boolean;
}

export const ChatSystem: React.FC<ChatSystemProps> = ({
  currentUser,
  effectiveRole,
  chatRooms,
  setChatRooms,
  chats,
  setChats,
  activeChatTargetId,
  setActiveChatTargetId,
  showNotification,
  students = [],
  activeTab
}) => {
  // Mobile long press message state
  const [mobileSelectedMsg, setMobileSelectedMsg] = useState<ChatMessage | null>(null);

  const handleTouchStart = (msg: ChatMessage) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setMobileSelectedMsg(msg);
    }, 400);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  // Sidebar & Navigation states
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [newChatText, setNewChatText] = useState('');
  const [showChatSidebarMobile, setShowChatSidebarMobile] = useState(true);

  // User Profiles Map (resolves any UUID to full name, avatar, role, phone, email)
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [userMap, setUserMap] = useState<Map<string, UserProfile>>(new Map());

  // Load User Profiles from Supabase user_profiles
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const profiles = await getAllUserProfiles();
      if (!isMounted) return;
      setAllProfiles(profiles);

      const map = new Map<string, UserProfile>();
      students.forEach(s => {
        const uid = s.uid || (s as any).id;
        if (uid) map.set(uid, s);
      });
      profiles.forEach(p => {
        if (p.uid) map.set(p.uid, p);
      });
      if (currentUser?.uid) {
        map.set(currentUser.uid, currentUser);
      }
      setUserMap(map);
    };
    load();
    return () => { isMounted = false; };
  }, [currentUser?.uid, students?.length]);

  // Helper to resolve user info reliably without displaying UUIDs
  const resolveUser = (uid?: string): UserProfile => {
    if (!uid) {
      return { uid: 'unknown', name: 'StudentOS Member', role: 'student', email: '' };
    }
    if (userMap.has(uid)) {
      return userMap.get(uid)!;
    }
    if (currentUser && currentUser.uid === uid) {
      return currentUser;
    }
    const foundInStudents = students.find(s => s.uid === uid || (s as any).id === uid);
    if (foundInStudents) return foundInStudents;

    const foundInProfiles = allProfiles.find(p => p.uid === uid);
    if (foundInProfiles) return foundInProfiles;

    // Clean fallback name (e.g. from email or formatted index) without raw UUID
    let cleanName = 'StudentOS Member';
    if (uid.includes('@')) {
      cleanName = uid.split('@')[0];
    } else if (uid.length > 8) {
      cleanName = `Member ${uid.slice(0, 5).toUpperCase()}`;
    }

    return {
      uid,
      name: cleanName,
      role: 'student',
      email: '',
      avatar: ''
    };
  };

  // Group creation & QR states
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<'group' | 'channel'>('group');
  const [newChannelCategory, setNewChannelCategory] = useState<'principal' | 'teacher' | 'class' | 'house' | 'club' | 'event'>('class');
  const [newRoomIcon, setNewRoomIcon] = useState('💬');
  const [newRoomDescription, setNewRoomDescription] = useState('');

  // Group settings & QR modal
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [editRoomName, setEditRoomName] = useState('');
  const [editRoomDescription, setEditRoomDescription] = useState('');
  const [editRoomIcon, setEditRoomIcon] = useState('💬');
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Member Profile Card Modal
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfile | null>(null);

  // Voice & Video Calls State
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const callTimerRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localMediaStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<any>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const ringtoneCtxRef = useRef<AudioContext | null>(null);
  const ringtoneTimerRef = useRef<any>(null);

  const startRingtoneSound = (type: 'incoming' | 'outgoing') => {
    stopRingtoneSound();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringtoneCtxRef.current = ctx;

      const playPulse = () => {
        if (!ringtoneCtxRef.current) return;
        if (ringtoneCtxRef.current.state === 'suspended') {
          ringtoneCtxRef.current.resume();
        }
        const now = ringtoneCtxRef.current.currentTime;
        const osc1 = ringtoneCtxRef.current.createOscillator();
        const osc2 = ringtoneCtxRef.current.createOscillator();
        const gain = ringtoneCtxRef.current.createGain();

        if (type === 'incoming') {
          osc1.frequency.setValueAtTime(440, now);
          osc2.frequency.setValueAtTime(480, now);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ringtoneCtxRef.current.destination);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.2);
          osc2.stop(now + 1.2);
        } else {
          osc1.frequency.setValueAtTime(425, now);
          osc2.frequency.setValueAtTime(450, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ringtoneCtxRef.current.destination);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.5);
          osc2.stop(now + 1.5);
        }
      };

      playPulse();
      ringtoneTimerRef.current = setInterval(playPulse, type === 'incoming' ? 2400 : 3600);
    } catch (err) {
      console.warn('Ringtone init note:', err);
    }
  };

  const stopRingtoneSound = () => {
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }
    if (ringtoneCtxRef.current) {
      try {
        ringtoneCtxRef.current.close();
      } catch (_) {}
      ringtoneCtxRef.current = null;
    }
  };

  const cleanupCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.close();
      } catch (_) {}
      peerConnectionRef.current = null;
    }
    if (localMediaStreamRef.current) {
      try {
        localMediaStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (_) {}
      localMediaStreamRef.current = null;
    }
    setRemoteStream(null);
    stopRingtoneSound();
    setActiveCall(null);
    setCallDuration(0);
  };

  useEffect(() => {
    if (!activeCall) {
      stopRingtoneSound();
      return;
    }
    if (activeCall.mode === 'incoming') {
      startRingtoneSound('incoming');
    } else if (activeCall.mode === 'outgoing') {
      startRingtoneSound('outgoing');
    } else {
      stopRingtoneSound();
    }
    return () => {
      stopRingtoneSound();
    };
  }, [activeCall?.mode, activeCall?.callId]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Video and Audio element media stream bindings (Prevents flickering/blinking)
  useEffect(() => {
    if (localVideoRef.current && localMediaStreamRef.current) {
      if (localVideoRef.current.srcObject !== localMediaStreamRef.current) {
        localVideoRef.current.srcObject = localMediaStreamRef.current;
      }
    }
  }, [activeCall?.mode, activeCall?.type, activeCall?.isVideoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    }
    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, activeCall?.mode]);

  // WebRTC Signal Exchange Channel Effect
  useEffect(() => {
    if (!activeCall || activeCall.mode !== 'connected') return;

    const channelId = `call_signal_${activeCall.callId}`;
    const signalChannel = supabase.channel(channelId);

    signalChannel
      .on('broadcast', { event: 'webrtc_signal' }, async (payload) => {
        const data = payload.payload;
        if (!data || data.senderUid === currentUser?.uid) return;

        const pc = peerConnectionRef.current;
        if (!pc) return;

        try {
          if (data.offer && !activeCall.isCaller) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            signalChannel.send({
              type: 'broadcast',
              event: 'webrtc_signal',
              payload: { answer, senderUid: currentUser?.uid }
            });
          } else if (data.answer && activeCall.isCaller) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          } else if (data.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } catch (e) {
          console.warn('WebRTC signal processing note:', e);
        }
      })
      .subscribe();

    const initiateWebRTC = async () => {
      if (peerConnectionRef.current) {
        try { peerConnectionRef.current.close(); } catch (_) {}
        peerConnectionRef.current = null;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });
      peerConnectionRef.current = pc;

      if (localMediaStreamRef.current) {
        localMediaStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localMediaStreamRef.current!);
        });
      }

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          setRemoteStream(prev => {
            const s = prev ? prev : new MediaStream();
            if (!s.getTracks().some(t => t.id === event.track.id)) {
              s.addTrack(event.track);
            }
            return new MediaStream(s.getTracks());
          });
        }
      };

      pc.onicecandidate = (evt) => {
        if (evt.candidate) {
          try {
            signalChannel.send({
              type: 'broadcast',
              event: 'webrtc_signal',
              payload: { candidate: evt.candidate, senderUid: currentUser?.uid }
            });
          } catch (_) {}
        }
      };

      // Only the CALLER creates the initial offer
      if (activeCall.isCaller) {
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: activeCall.type === 'video' });
          await pc.setLocalDescription(offer);
          signalChannel.send({
            type: 'broadcast',
            event: 'webrtc_signal',
            payload: { offer, senderUid: currentUser?.uid }
          });
        } catch (_) {}
      }
    };

    initiateWebRTC();

    return () => {
      supabase.removeChannel(signalChannel);
    };
  }, [activeCall?.callId, activeCall?.mode]);

  // Global Call Realtime Listener for Direct Calls
  useEffect(() => {
    if (!currentUser?.uid) return;

    const userCallsChannel = supabase.channel(`user_calls_${currentUser.uid}`);

    userCallsChannel
      .on('broadcast', { event: 'call_invite' }, (payload) => {
        const data = payload.payload;
        if (data && data.targetUid === currentUser.uid) {
          const caller = resolveUser(data.callerUid);
          setActiveCall({
            callId: data.callId,
            targetUser: caller,
            type: data.callType || 'audio',
            mode: 'incoming',
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            isCaller: false
          });
        }
      })
      .on('broadcast', { event: 'call_accepted' }, (payload) => {
        if (activeCallRef.current && payload.payload?.callId === activeCallRef.current.callId) {
          stopRingtoneSound();
          setActiveCall(prev => prev ? { ...prev, mode: 'connected', startTime: Date.now() } : null);
          showNotification('Call connected!');
        }
      })
      .on('broadcast', { event: 'call_rejected' }, (payload) => {
        if (activeCallRef.current && payload.payload?.callId === activeCallRef.current.callId) {
          cleanupCall();
          showNotification('Call declined.');
        }
      })
      .on('broadcast', { event: 'call_ended' }, (payload) => {
        if (activeCallRef.current && payload.payload?.callId === activeCallRef.current.callId) {
          cleanupCall();
          showNotification('Call ended.');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userCallsChannel);
    };
  }, [currentUser?.uid]);

  // Active Room Realtime Subscription Hook
  useEffect(() => {
    if (!activeChatTargetId) return;

    const channelName = `room_channel_${activeChatTargetId}`;
    const roomChannel = supabase.channel(channelName);

    roomChannel
      .on('broadcast', { event: 'new_chat_message' }, (payload) => {
        if (payload.payload) {
          const newMsg = payload.payload as ChatMessage;
          setChats(prev => {
            const idx = prev.findIndex(m => m.id === newMsg.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...newMsg };
              return updated;
            }
            return [...prev, newMsg];
          });
        }
      })
      .on('broadcast', { event: 'call_invite' }, (payload) => {
        const data = payload.payload;
        if (data && data.targetUid === currentUser?.uid) {
          const caller = resolveUser(data.callerUid);
          setActiveCall({
            callId: data.callId,
            targetUser: caller,
            type: data.callType || 'audio',
            mode: 'incoming',
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false
          });
        }
      })
      .on('broadcast', { event: 'call_accepted' }, (payload) => {
        if (activeCallRef.current && payload.payload?.callId === activeCallRef.current.callId) {
          setActiveCall(prev => prev ? { ...prev, mode: 'connected', startTime: Date.now() } : null);
          showNotification('Call connected!');
        }
      })
      .on('broadcast', { event: 'call_rejected' }, (payload) => {
        if (activeCallRef.current && payload.payload?.callId === activeCallRef.current.callId) {
          if (localMediaStreamRef.current) {
            localMediaStreamRef.current.getTracks().forEach(t => t.stop());
            localMediaStreamRef.current = null;
          }
          setActiveCall(null);
          showNotification('Call declined.');
        }
      })
      .on('broadcast', { event: 'call_ended' }, (payload) => {
        if (activeCallRef.current && payload.payload?.callId === activeCallRef.current.callId) {
          if (localMediaStreamRef.current) {
            localMediaStreamRef.current.getTracks().forEach(t => t.stop());
            localMediaStreamRef.current = null;
          }
          setActiveCall(null);
          showNotification('Call ended.');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [activeChatTargetId, currentUser?.uid, setChats]);

  // Call Duration Timer Effect
  useEffect(() => {
    if (activeCall?.mode === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [activeCall?.mode]);

  // Message interaction states
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);
  const [activeMenuMsg, setActiveMenuMsg] = useState<ChatMessage | null>(null);
  const longPressTimerRef = useRef<any>(null);

  const handleTouchStartMessage = (msg: ChatMessage) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setActiveMenuMsg(msg);
    }, 450);
  };

  const handleTouchEndMessage = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Attachments & Voice note states
  const [attachedFiles, setAttachedFiles] = useState<ChatAttachment[]>([]);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Phase 3 Realtime States: Presence, Typing, Mentions
  const [onlineUsersMap, setOnlineUsersMap] = useState<Map<string, UserPresence>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // Online Presence Sync
  useEffect(() => {
    if (currentUser) {
      presenceService.init({
        uid: currentUser.uid,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        avatar: currentUser.avatar
      });
      return presenceService.subscribe(setOnlineUsersMap);
    }
  }, [currentUser?.uid]);

  // Realtime Typing Indicator Subscription
  useEffect(() => {
    if (!activeChatTargetId) return;
    const typingChannel = supabase.channel(`chat_typing_${activeChatTargetId}`);
    const typingTimers: Record<string, any> = {};

    typingChannel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload?.payload && payload.payload.uid !== currentUser?.uid) {
        const { uid, name } = payload.payload;
        setTypingUsers(prev => ({ ...prev, [uid]: name }));

        if (typingTimers[uid]) clearTimeout(typingTimers[uid]);
        typingTimers[uid] = setTimeout(() => {
          setTypingUsers(prev => {
            const next = { ...prev };
            delete next[uid];
            return next;
          });
        }, 2500);
      }
    }).subscribe();

    return () => {
      Object.values(typingTimers).forEach(clearTimeout);
      supabase.removeChannel(typingChannel);
    };
  }, [activeChatTargetId, currentUser?.uid]);

  const chatScrollViewRef = useRef<HTMLDivElement>(null);
  const prevTargetIdRef = useRef<string>(activeChatTargetId);
  const prevChatsLengthRef = useRef<number>(chats.length);

  // Auto-scroll on new messages or room switch
  useEffect(() => {
    const el = chatScrollViewRef.current;
    if (!el) return;

    const targetChanged = prevTargetIdRef.current !== activeChatTargetId;
    prevTargetIdRef.current = activeChatTargetId;

    if (targetChanged) {
      // Switched rooms -> scroll to bottom
      el.scrollTop = el.scrollHeight;
      prevChatsLengthRef.current = chats.length;
      return;
    }

    const hasNewMessages = chats.length > prevChatsLengthRef.current;
    prevChatsLengthRef.current = chats.length;

    if (hasNewMessages) {
      const roomMsgs = chats.filter(c => c.targetId === activeChatTargetId || (!c.targetId && activeChatTargetId === 'group-all'));
      const lastMsg = roomMsgs[roomMsgs.length - 1];
      const isMine = lastMsg && lastMsg.ownerUid === currentUser?.uid;

      // User is considered near bottom if within 150px of bottom
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;

      if (isMine || isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [chats, activeChatTargetId, currentUser?.uid]);

  // Handle Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setAttachedFiles(prev => [
            ...prev,
            { type: 'audio', url: base64Audio, name: `Voice Note (${recordingTime}s)` }
          ]);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      showNotification('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      clearInterval(timerRef.current);
    }
  };

  // Handle File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const isPdf = file.type.includes('pdf');
      const attachmentType: 'image' | 'video' | 'pdf' | 'file' = isImg ? 'image' : isVid ? 'video' : isPdf ? 'pdf' : 'file';

      reader.onloadend = () => {
        setAttachedFiles(prev => [
          ...prev,
          {
            type: attachmentType,
            url: reader.result as string,
            name: file.name,
            size: `${(file.size / 1024).toFixed(1)} KB`
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Start or open Direct Message
  const handleStartDirectMessage = async (targetUser: UserProfile) => {
    if (!currentUser) return;
    const dmRoom = await getOrCreateDirectMessageRoom({
      uid: currentUser.uid,
      name: currentUser.name,
      avatar: currentUser.avatar,
      role: currentUser.role
    }, {
      uid: targetUser.uid,
      name: targetUser.name,
      avatar: targetUser.avatar,
      role: targetUser.role
    });
    
    setChatRooms(prev => {
      if (prev.some(r => r.id === dmRoom.id)) return prev;
      return [...prev, dmRoom];
    });

    setActiveChatTargetId(dmRoom.id);
    setShowNewDmModal(false);
    setShowChatSidebarMobile(false);
    showNotification(`Chat opened with ${targetUser.name}`);
  };

  // Start Call (Voice or Video)
  const handleStartCall = async (targetUser: UserProfile, type: 'audio' | 'video') => {
    if (!currentUser) return;
    cleanupCall(); // Rebuild lifecycle: ensure previous peer connections/tracks are destroyed

    const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === 'video' ? { width: 1280, height: 720 } : false
      });
      localMediaStreamRef.current = stream;
    } catch (e) {
      console.warn('Microphone/Camera access note during call start', e);
    }

    setActiveCall({
      callId,
      targetUser,
      type,
      mode: 'outgoing',
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      isCaller: true
    });

    try {
      const payload = {
        callId,
        callerUid: currentUser.uid,
        targetUid: targetUser.uid,
        callType: type
      };
      supabase.channel(`room_channel_${activeChatTargetId}`).send({
        type: 'broadcast',
        event: 'call_invite',
        payload
      });
      supabase.channel(`user_calls_${targetUser.uid}`).send({
        type: 'broadcast',
        event: 'call_invite',
        payload
      });
    } catch (_) {}

    showNotification(`Calling ${targetUser.name}...`);
  };

  // End Call
  const handleEndCall = () => {
    if (activeCall) {
      try {
        const payload = { callId: activeCall.callId };
        supabase.channel(`room_channel_${activeChatTargetId}`).send({
          type: 'broadcast',
          event: 'call_ended',
          payload
        });
        if (activeCall.targetUser?.uid) {
          supabase.channel(`user_calls_${activeCall.targetUser.uid}`).send({
            type: 'broadcast',
            event: 'call_ended',
            payload
          });
        }
      } catch (_) {}
    }
    cleanupCall();
    showNotification('Call ended.');
  };

  // Send Chat Message
  const handleSendChat = async () => {
    if ((!newChatText.trim() && attachedFiles.length === 0) || !currentUser) return;

    // AI Moderation
    const mod = moderateChatMessage(newChatText, currentUser.role);
    if (mod.flagged && mod.category === 'fake_news') {
      showNotification(`⚠️ Message Flagged: ${mod.reason}`);
    }

    const messageText = mod.flagged ? mod.safeMessage : newChatText.trim();

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newMsg: ChatMessage = {
      id: msgId,
      name: currentUser.name || 'Student',
      role: effectiveRole,
      house: currentUser.house || 'Ruby',
      message: messageText,
      createdAt: new Date().toISOString(),
      targetId: activeChatTargetId || 'group-all',
      ownerUid: currentUser.uid,
      attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
      replyToId: replyingTo?.id,
      replyToSender: replyingTo?.name,
      replyToText: replyingTo?.message,
      readBy: [currentUser.uid],
      deliveredTo: [currentUser.uid],
      flaggedReason: mod.flagged ? mod.reason : undefined
    };

    // Optimistic UI update
    setChats(prev => [...prev, newMsg]);
    setNewChatText('');
    setAttachedFiles([]);
    setReplyingTo(null);

    // Save to Supabase
    await savePeerMessage(newMsg);

    // Create Notification if DM
    if (activeChatTargetId.startsWith('dm_')) {
      const uids = activeChatTargetId.replace('dm_', '').split('_');
      const friendUid = uids.find(id => id !== currentUser.uid);
      if (friendUid) {
        await saveAppNotification({
          id: `notif-${Date.now()}`,
          title: `New Message from ${currentUser.name}`,
          message: messageText.slice(0, 60),
          type: 'chat',
          createdAt: new Date().toISOString(),
          isRead: false,
          targetUserId: friendUid,
          linkTab: 'peer_chat'
        });
      }
    }

    // Check if message mentions users and send mention notification
    if (messageText.includes('@')) {
      availableUsersList.forEach(u => {
        if (u.uid !== currentUser.uid && messageText.toLowerCase().includes(`@${u.name.toLowerCase()}`)) {
          saveAppNotification({
            id: `mention-${Date.now()}-${u.uid}`,
            title: `You were mentioned by ${currentUser.name}`,
            message: messageText.slice(0, 80),
            type: 'mention',
            createdAt: new Date().toISOString(),
            isRead: false,
            targetUserId: u.uid,
            linkTab: 'peer_chat'
          }).catch(console.error);
        }
      });
    }
  };

  // Edit Message
  const handleSaveEdit = async (msgId: string) => {
    if (!editText.trim()) return;
    setChats(prev => prev.map(c => c.id === msgId ? { ...c, message: editText.trim(), isEdited: true, editedAt: new Date().toISOString() } : c));
    
    const targetMsg = chats.find(c => c.id === msgId);
    if (targetMsg) {
      await savePeerMessage({
        ...targetMsg,
        message: editText.trim(),
        isEdited: true,
        editedAt: new Date().toISOString()
      });
    }
    setEditingMsgId(null);
    setEditText('');
    showNotification('Message updated');
  };

  // React to Message
  const handleAddReaction = async (msgId: string, emoji: string) => {
    if (!currentUser) return;
    setChats(prev => prev.map(msg => {
      if (msg.id !== msgId) return msg;
      const reactions = { ...(msg.reactions || {}) };
      const currentUsers = reactions[emoji] || [];

      if (currentUsers.includes(currentUser.uid)) {
        reactions[emoji] = currentUsers.filter(u => u !== currentUser.uid);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...currentUsers, currentUser.uid];
      }

      const updated = { ...msg, reactions };
      savePeerMessage(updated).catch(console.error);
      return updated;
    }));
  };

  // Delete Message (For me vs For Everyone)
  const handleDeleteMessage = async (msgId: string, forEveryone: boolean) => {
    if (!currentUser) return;

    if (forEveryone) {
      setChats(prev => prev.filter(c => c.id !== msgId));
      await deletePeerMessage(msgId);
      showNotification('Message deleted for everyone.');
    } else {
      setChats(prev => prev.map(c => c.id === msgId ? { ...c, deletedFor: [...(c.deletedFor || []), currentUser.uid] } : c));
      const targetMsg = chats.find(c => c.id === msgId);
      if (targetMsg) {
        await savePeerMessage({
          ...targetMsg,
          deletedFor: [...(targetMsg.deletedFor || []), currentUser.uid]
        });
      }
      showNotification('Message hidden for you.');
    }
  };

  // Toggle Pin Message
  const handleTogglePin = async (msgId: string) => {
    setChats(prev => prev.map(msg => {
      if (msg.id !== msgId) return msg;
      const updated = { ...msg, isPinned: !msg.isPinned };
      savePeerMessage(updated).catch(console.error);
      return updated;
    }));
    showNotification('Pin status updated.');
  };

  // Forward Message
  const handleForwardMessage = async (targetRoomId: string) => {
    if (!forwardingMsg || !currentUser) return;
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fwdMsg: ChatMessage = {
      ...forwardingMsg,
      id: msgId,
      name: currentUser.name || 'Student',
      ownerUid: currentUser.uid,
      targetId: targetRoomId,
      createdAt: new Date().toISOString(),
      message: `[Forwarded]: ${forwardingMsg.message}`
    };

    setChats(prev => [...prev, fwdMsg]);
    await savePeerMessage(fwdMsg);
    setForwardingMsg(null);
    showNotification('Message forwarded successfully!');
  };

  // Join Room via Code
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomCode.trim() || !currentUser) return;

    const res = await joinChatRoom(joinRoomCode.trim().toUpperCase(), currentUser.uid);
    if (res.success && res.room) {
      setChatRooms(prev => {
        if (prev.some(r => r.id === res.room!.id)) return prev;
        return [...prev, res.room!];
      });
      setActiveChatTargetId(res.room.id);
      setJoinRoomCode('');
      setIsCreatingRoom(false);
      showNotification(res.alreadyJoined ? `Already joined ${res.room.name}` : `Joined room: ${res.room.name}`);
    } else {
      showNotification(res.message || 'Room code not found or invalid.');
    }
  };

  // Create New Room / Channel
  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !currentUser) return;

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom: ChatRoom = {
      id: `room-${Date.now()}`,
      name: newRoomName.trim(),
      type: newRoomType,
      channelCategory: newRoomType === 'channel' ? newChannelCategory : undefined,
      icon: newRoomIcon || '💬',
      description: newRoomDescription.trim() || 'Custom chat room',
      code,
      creatorId: currentUser.uid,
      members: [currentUser.uid],
      moderators: [currentUser.uid]
    };

    setChatRooms(prev => [...prev, newRoom]);
    setActiveChatTargetId(newRoom.id);
    setIsCreatingRoom(false);
    setNewRoomName('');
    setNewRoomDescription('');

    await saveChatRoom(newRoom);
    showNotification(`Created ${newRoomType}: ${newRoom.name} (Code: ${code})`);
  };

  // Active Room Resolution
  const activeRoomInfo = chatRooms.find(r => r.id === activeChatTargetId) || {
    id: 'group-all',
    name: 'General Lounge',
    type: 'group' as const,
    icon: '🌍',
    description: 'School-wide lounge for students and teachers',
    code: 'GLOBAL'
  };

  // Compute DM target profile if active room is a Direct Message
  const isDirectMessage = activeRoomInfo.type === 'friend' || activeRoomInfo.id.startsWith('dm_');
  let dmOtherUser: UserProfile | null = null;
  if (isDirectMessage && activeRoomInfo.members) {
    const otherUid = activeRoomInfo.members.find(m => m !== currentUser?.uid);
    if (otherUid) {
      dmOtherUser = resolveUser(otherUid);
    }
  }

  const activeDisplayTitle = isDirectMessage && dmOtherUser ? dmOtherUser.name : activeRoomInfo.name;
  const activeDisplayIcon = isDirectMessage && dmOtherUser ? (dmOtherUser.avatar || '👤') : activeRoomInfo.icon;
  const activeDisplayDesc = isDirectMessage && dmOtherUser 
    ? `${dmOtherUser.role.toUpperCase()} • ${dmOtherUser.grade || 'Campus Member'}` 
    : activeRoomInfo.description;

  const isBroadcastChannel = activeRoomInfo.type === 'channel';
  const isModerator = (activeRoomInfo.moderators || []).includes(currentUser?.uid || '') || activeRoomInfo.creatorId === currentUser?.uid;
  const canPostInChannel = !isBroadcastChannel || effectiveRole === 'teacher' || effectiveRole === 'admin' || effectiveRole === 'super_admin' || effectiveRole === 'coordinator' || isModerator;

  // Filter messages for current room & search query
  const roomMessages = chats.filter(c => {
    const isTarget = c.targetId === activeChatTargetId || (!c.targetId && activeChatTargetId === 'group-all');
    if (!isTarget) return false;
    if (c.deletedFor?.includes(currentUser?.uid || '')) return false;
    if (!messageSearchQuery) return true;

    const q = messageSearchQuery.toLowerCase();
    return c.message.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });

  const pinnedMessages = roomMessages.filter(m => m.isPinned);

  // Categorize Chat Rooms into Direct Messages and Group Rooms
  const dmRooms = chatRooms.filter(r => r.type === 'friend' || r.id.startsWith('dm_'));
  const groupRooms = chatRooms.filter(r => r.type !== 'friend' && !r.id.startsWith('dm_'));

  // Available Users list for starting new DMs
  const availableUsersList = allProfiles.length > 0 ? allProfiles : students;

  return (
    <>
      <div className={activeTab === 'peer_chat' || !activeTab ? 'h-full flex flex-col' : 'hidden'}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-[calc(100vh-8.5rem)] md:h-[calc(100vh-9.5rem)] min-h-[500px] max-w-7xl mx-auto shadow-2xl animate-fadeIn font-sans">
      
      {/* Left Column: Chat Rooms & Direct Messages Sidebar */}
      <div className={`md:col-span-4 bg-slate-900/90 border border-white/10 rounded-3xl p-4 flex flex-col min-h-0 justify-between ${showChatSidebarMobile ? 'flex h-full' : 'hidden md:flex'}`}>
        <div className="space-y-3.5 flex-1 flex flex-col min-h-0">
          
          {/* Header & New Actions */}
          <div className="flex justify-between items-center shrink-0">
            <h3 className="font-black text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-indigo-400" />
              StudentOS Chat
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNewDmModal(true)}
                title="Start Direct Message"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-2.5 py-1.5 rounded-xl font-bold uppercase transition-all shadow-md active:scale-95 flex items-center gap-1"
              >
                <UserPlus className="w-3 h-3" />
                <span className="hidden sm:inline">DM</span>
              </button>
              <button
                onClick={() => setIsCreatingRoom(true)}
                title="Create or Join Group"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-2.5 py-1.5 rounded-xl font-bold uppercase transition-all shadow-md active:scale-95 flex items-center gap-1"
              >
                <Users className="w-3 h-3" />
                <span className="hidden sm:inline">Group</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              placeholder="Search users, groups, or phone..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Sidebar Chat List (Separated DMs and Groups) */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            
            {/* DIRECT MESSAGES SECTION */}
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1 py-1">
                <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  Direct Messages ({dmRooms.length})
                </span>
                <button
                  onClick={() => setShowNewDmModal(true)}
                  className="text-[10px] text-teal-400 hover:underline font-bold"
                >
                  + New
                </button>
              </div>

              {dmRooms.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic px-2 py-1">No direct messages yet. Click + New to chat!</p>
              ) : (
                dmRooms
                  .filter(r => {
                    if (!chatSearchQuery) return true;
                    const otherUid = (r.members || []).find(m => m !== currentUser?.uid);
                    const user = otherUid ? resolveUser(otherUid) : null;
                    const query = chatSearchQuery.toLowerCase();
                    return r.name.toLowerCase().includes(query) || 
                           (user && (user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)));
                  })
                  .map(room => {
                    const isActive = activeChatTargetId === room.id;
                    const otherUid = (room.members || []).find(m => m !== currentUser?.uid);
                    const otherUser = otherUid ? resolveUser(otherUid) : null;
                    const displayName = otherUser ? otherUser.name : room.name;

                    // Get last message in this room
                    const lastMsg = chats.filter(c => c.targetId === room.id).pop();

                    return (
                      <button
                        key={room.id}
                        onClick={() => {
                          setActiveChatTargetId(room.id);
                          setShowChatSidebarMobile(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-2xl border transition-all flex items-center gap-2.5 ${isActive ? 'bg-teal-600/20 border-teal-500/50 text-white shadow-lg' : 'bg-slate-950/40 border-white/5 hover:border-white/10 hover:bg-slate-950/70 text-slate-300'}`}
                      >
                        <div className="relative shrink-0">
                          {otherUser?.avatar || otherUser?.photoURL ? (
                            <img src={otherUser.avatar || otherUser.photoURL} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-teal-600/30 text-teal-300 font-black text-xs flex items-center justify-center border border-teal-500/30">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900 absolute bottom-0 right-0" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold truncate text-white">{displayName}</span>
                            {lastMsg && (
                              <span className="text-[9px] text-slate-500 shrink-0">
                                {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {lastMsg ? lastMsg.message : (otherUser ? `${otherUser.role.toUpperCase()} • ${otherUser.grade || 'Direct Message'}` : 'Start conversation')}
                          </p>
                        </div>
                      </button>
                    );
                  })
              )}
            </div>

            {/* GROUP ROOMS SECTION */}
            <div className="space-y-1 border-t border-white/10 pt-2.5">
              <div className="flex justify-between items-center px-1 py-1">
                <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  Groups & Channels ({groupRooms.length})
                </span>
                <button
                  onClick={() => setIsCreatingRoom(true)}
                  className="text-[10px] text-indigo-400 hover:underline font-bold"
                >
                  + Create
                </button>
              </div>

              {groupRooms
                .filter(room => {
                  if (!chatSearchQuery) return true;
                  return room.name.toLowerCase().includes(chatSearchQuery.toLowerCase()) || 
                         room.type.toLowerCase().includes(chatSearchQuery.toLowerCase());
                })
                .map((room) => {
                  const isActive = activeChatTargetId === room.id;
                  let badgeStyle = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                  if (room.type === "channel") badgeStyle = "bg-rose-500/10 text-rose-400 border-rose-500/20";

                  const lastMsg = chats.filter(c => c.targetId === room.id || (!c.targetId && room.id === 'group-all')).pop();

                  return (
                    <button
                      key={room.id}
                      onClick={() => {
                        setActiveChatTargetId(room.id);
                        setShowChatSidebarMobile(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-2xl border transition-all flex items-center gap-2.5 ${isActive ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-lg' : 'bg-slate-950/40 border-white/5 hover:border-white/10 hover:bg-slate-950/70 text-slate-300'}`}
                    >
                      <span className="text-xl shrink-0 p-1.5 bg-slate-900 border border-white/10 rounded-xl">{room.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold truncate text-white">{room.name}</span>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${badgeStyle}`}>
                            {room.type}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {lastMsg ? `${lastMsg.name.split(' ')[0]}: ${lastMsg.message}` : room.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
            </div>

          </div>
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-white/10 flex justify-between items-center text-[11px] text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Sync
          </span>
          <span className="font-bold text-indigo-400 truncate max-w-[150px]">{currentUser?.name}</span>
        </div>
      </div>

      {/* Right Column: Chat Dialog Box */}
      <div className={`md:col-span-8 bg-slate-900/90 border border-white/10 rounded-3xl p-5 flex flex-col min-h-0 justify-between ${!showChatSidebarMobile ? 'flex h-full' : 'hidden md:flex'}`}>
        
        {/* Active Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowChatSidebarMobile(true)}
              className="md:hidden p-1.5 bg-white/5 rounded-lg border border-white/10 text-white text-[11px] flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Chats
            </button>

            {/* Clickable Avatar or Icon to view profile or details */}
            <button
              onClick={() => {
                if (isDirectMessage && dmOtherUser) {
                  setSelectedProfileUser(dmOtherUser);
                } else {
                  setEditRoomName(activeRoomInfo.name);
                  setEditRoomDescription(activeRoomInfo.description || '');
                  setEditRoomIcon(activeRoomInfo.icon || '💬');
                  setShowGroupSettings(true);
                }
              }}
              className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
            >
              {typeof activeDisplayIcon === 'string' && activeDisplayIcon.length > 2 ? (
                <img src={activeDisplayIcon} alt="" className="w-10 h-10 rounded-2xl object-cover border border-white/10" />
              ) : (
                <span className="text-2xl p-1.5 bg-slate-950 border border-white/10 rounded-2xl">{activeDisplayIcon}</span>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-sm text-white">{activeDisplayTitle}</h4>
                  {isDirectMessage && (
                    <span className="text-[9px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full font-bold">
                      Direct Message
                    </span>
                  )}
                  {activeRoomInfo.type === 'channel' && (
                    <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">
                      📢 Broadcast Channel
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{activeDisplayDesc}</p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Call Buttons for Direct Messages or Groups */}
            {isDirectMessage && dmOtherUser && (
              <>
                <button
                  onClick={() => handleStartCall(dmOtherUser!, 'audio')}
                  title="Voice Call"
                  className="p-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl border border-emerald-500/30 transition-all"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleStartCall(dmOtherUser!, 'video')}
                  title="Video Call"
                  className="p-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/30 transition-all"
                >
                  <Video className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Search messages toggle */}
            <div className="relative hidden sm:block">
              <input
                type="text"
                value={messageSearchQuery}
                onChange={e => setMessageSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32 focus:w-44 transition-all"
              />
            </div>

            {/* Group QR Modal Trigger */}
            {!isDirectMessage && (
              <button
                onClick={() => setShowQrModal(true)}
                title="Group QR Code & Code"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-white/10 transition-all"
              >
                <QrCode className="w-4 h-4" />
              </button>
            )}

            {/* Settings button */}
            {!isDirectMessage && (
              <button
                onClick={() => {
                  setEditRoomName(activeRoomInfo.name);
                  setEditRoomDescription(activeRoomInfo.description || '');
                  setEditRoomIcon(activeRoomInfo.icon || '💬');
                  setShowGroupSettings(true);
                }}
                title="Group Settings"
                className="p-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/30 transition-all flex items-center gap-1 text-xs font-bold"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Pinned Messages Header Banner */}
        {pinnedMessages.length > 0 && (
          <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2 truncate">
              <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold">Pinned:</span>
              <span className="truncate">{pinnedMessages[0].message}</span>
            </div>
            <button
              onClick={() => handleTogglePin(pinnedMessages[0].id)}
              className="text-[10px] text-amber-400 underline font-bold shrink-0 ml-2"
            >
              Unpin
            </button>
          </div>
        )}

        {/* Chat Messages Log View */}
        <div 
          ref={chatScrollViewRef}
          id="chat-scroll-view"
          className="flex-1 min-h-0 overflow-y-auto space-y-3 my-3 pr-2 scrollbar-thin"
        >
          {roomMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
              <Sparkles className="w-8 h-8 text-indigo-400/40 animate-bounce" />
              <p className="font-medium">No messages yet in this room.</p>
              <p className="text-[10px] text-slate-600">Be the first to say hello!</p>
            </div>
          ) : (
            roomMessages.map((msg) => {
              const isMine = msg.ownerUid === currentUser?.uid;
              const senderUser = resolveUser(msg.ownerUid);
              const displayName = senderUser ? senderUser.name : msg.name;

              return (
                <div
                  key={msg.id}
                  onTouchStart={() => handleTouchStartMessage(msg)}
                  onTouchEnd={handleTouchEndMessage}
                  className={`flex items-start gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Sender Avatar - Click to open Profile Card */}
                  <button
                    onClick={() => setSelectedProfileUser(senderUser)}
                    title={`View profile of ${displayName}`}
                    className="shrink-0 hover:scale-105 transition-transform"
                  >
                    {senderUser?.avatar || senderUser?.photoURL ? (
                      <img src={senderUser.avatar || senderUser.photoURL} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-300 font-extrabold text-xs flex items-center justify-center border border-indigo-500/30">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>

                  <div className={`max-w-[75%] space-y-1 ${isMine ? 'items-end' : 'items-start'}`}>
                    
                    {/* Header info */}
                    <div className={`flex items-center gap-1.5 text-[10px] ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <button
                        onClick={() => setSelectedProfileUser(senderUser)}
                        className="font-bold text-slate-300 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
                      >
                        <span>{displayName}</span>
                        {senderUser && getVerificationStatus(senderUser).isVerified && (
                          <span title="StudentOS Verified" className="inline-flex items-center">
                            <ShieldCheck className="w-3 h-3 text-indigo-400" />
                          </span>
                        )}
                      </button>
                      <span className="text-[9px] text-indigo-400 uppercase font-black bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">
                        {senderUser?.role || msg.role}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-500">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMine && (
                          <span className="text-[10px]" title={msg.readBy && msg.readBy.length > 1 ? 'Read' : msg.deliveredTo ? 'Delivered' : 'Sent'}>
                            {msg.readBy && msg.readBy.length > 1 ? (
                              <CheckCheck className="w-3.5 h-3.5 text-sky-400 inline" />
                            ) : msg.deliveredTo && msg.deliveredTo.length > 0 ? (
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-400 inline" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reply Context preview */}
                    {msg.replyToText && (
                      <div className="bg-slate-950/60 border-l-2 border-indigo-500 p-1.5 rounded-r-lg text-[10px] text-slate-400 italic">
                        <span className="font-bold text-indigo-300">{msg.replyToSender}: </span>
                        <span>{msg.replyToText}</span>
                      </div>
                    )}

                    {/* Main Bubble */}
                    <div
                      onTouchStart={() => handleTouchStart(msg)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchEnd}
                      className={`p-3 rounded-2xl text-xs relative group ${isMine ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-950 border border-white/10 text-slate-200 rounded-tl-none'}`}
                    >
                      
                      {/* Flagged warning badge */}
                      {msg.flaggedReason && (
                        <div className="text-[9px] bg-rose-500/20 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded-md mb-1 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Safety Flag: {msg.flaggedReason}</span>
                        </div>
                      )}

                      {/* Editing state vs Text */}
                      {editingMsgId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            className="w-full bg-slate-900 border border-white/20 rounded-xl p-2 text-xs text-white"
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingMsgId(null)} className="text-[10px] text-slate-400">Cancel</button>
                            <button onClick={() => handleSaveEdit(msg.id)} className="text-[10px] bg-indigo-500 text-white px-2 py-1 rounded-lg font-bold">Save</button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                      )}

                      {/* Attachments rendering */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {msg.attachments.map((att, i) => (
                            <div key={i} className="rounded-xl overflow-hidden border border-white/10 bg-black/20 p-1.5">
                              {att.type === 'image' && (
                                <img src={att.url} alt={att.name} className="max-h-48 rounded-lg object-cover w-full" />
                              )}
                              {att.type === 'audio' && (
                                <audio controls src={att.url} className="w-full h-8" />
                              )}
                              {att.type === 'pdf' && (
                                <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-300 hover:underline text-[11px] font-bold">
                                  <Paperclip className="w-3.5 h-3.5" />
                                  <span>{att.name}</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions toolbar on Hover with Quick Reactions */}
                      <div className={`absolute top-1 ${isMine ? '-left-44' : '-right-44'} hidden group-hover:flex items-center gap-1 bg-slate-900 border border-white/10 p-1.5 rounded-2xl shadow-2xl z-10`}>
                        {['👍', '❤️', '😂', '😮', '🎉'].map(emoji => (
                          <button key={emoji} onClick={() => handleAddReaction(msg.id, emoji)} className="hover:scale-125 transition-transform p-0.5 text-xs" title={`React with ${emoji}`}>
                            {emoji}
                          </button>
                        ))}
                        <button onClick={() => setReplyingTo(msg)} title="Reply" className="p-1 hover:text-indigo-400 text-slate-400"><Reply className="w-3 h-3" /></button>
                        <button onClick={() => setForwardingMsg(msg)} title="Forward" className="p-1 hover:text-indigo-400 text-slate-400"><Forward className="w-3 h-3" /></button>
                        <button onClick={() => handleTogglePin(msg.id)} title="Pin Message" className="p-1 hover:text-amber-400 text-slate-400"><Pin className="w-3 h-3" /></button>
                        {isMine && <button onClick={() => { setEditingMsgId(msg.id); setEditText(msg.message); }} title="Edit" className="p-1 hover:text-indigo-400 text-slate-400"><Edit3 className="w-3 h-3" /></button>}
                        {(isMine || isModerator) && <button onClick={() => handleDeleteMessage(msg.id, true)} title="Delete Everyone" className="p-1 hover:text-rose-400 text-slate-400"><Trash2 className="w-3 h-3" /></button>}
                      </div>
                    </div>

                    {/* Reactions display */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(msg.reactions).map(([emoji, uids]) => (
                          <button
                            key={emoji}
                            onClick={() => handleAddReaction(msg.id, emoji)}
                            className="bg-slate-950/80 border border-white/10 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 text-slate-300 hover:border-indigo-500"
                          >
                            <span>{emoji}</span>
                            <span className="font-bold text-[9px] text-indigo-400">{(uids as any).length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Replying context banner */}
        {replyingTo && (
          <div className="bg-slate-950 border-t border-indigo-500/30 p-2.5 flex items-center justify-between text-xs text-slate-300 rounded-t-xl shrink-0">
            <div className="flex items-center gap-2 truncate">
              <Reply className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-bold text-indigo-300">Replying to {replyingTo.name}: </span>
              <span className="truncate italic text-slate-400">{replyingTo.message}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Typing indicator banner */}
        {Object.keys(typingUsers).length > 0 && (
          <div className="text-[11px] font-bold text-indigo-400 flex items-center gap-1.5 animate-pulse px-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
            <span>{Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...</span>
          </div>
        )}

        {/* Mention Autocomplete Menu */}
        {showMentionMenu && (
          <div className="bg-slate-950 border border-indigo-500/40 rounded-2xl p-2 max-h-40 overflow-y-auto space-y-1 shadow-2xl z-30 shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 px-2 py-0.5">
              Mention Member
            </div>
            {availableUsersList
              .filter(u => u.name.toLowerCase().includes(mentionQuery) || u.role.toLowerCase().includes(mentionQuery))
              .slice(0, 5)
              .map(u => (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => {
                    const words = newChatText.split(' ');
                    words.pop();
                    setNewChatText([...words, `@${u.name}`].join(' ') + ' ');
                    setShowMentionMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-indigo-600/30 rounded-xl text-xs text-white flex items-center justify-between transition-colors"
                >
                  <span className="font-bold text-indigo-300">@{u.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{u.role}</span>
                </button>
              ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="pt-3 border-t border-white/10 space-y-2 shrink-0">
          
          {/* Attached Files Preview */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              {attachedFiles.map((f, i) => (
                <div key={i} className="bg-slate-950 border border-white/10 px-2.5 py-1 rounded-xl text-[10px] text-slate-300 flex items-center gap-2">
                  <span className="font-bold">{f.name}</span>
                  <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-300">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Upload Attachment */}
            <label className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-white rounded-2xl cursor-pointer transition-colors">
              <Paperclip className="w-4 h-4" />
              <input type="file" multiple onChange={handleFileUpload} className="hidden" />
            </label>

            {/* Mic / Voice Note Record Button */}
            <button
              onClick={isRecordingAudio ? stopRecording : startRecording}
              className={`p-2.5 rounded-2xl border transition-all ${isRecordingAudio ? 'bg-rose-600 text-white border-rose-500 animate-pulse' : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white hover:bg-slate-800'}`}
              title={isRecordingAudio ? "Stop Recording" : "Record Voice Note"}
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Input Text Box */}
            <input
              type="text"
              value={newChatText}
              onChange={e => {
                const val = e.target.value;
                setNewChatText(val);

                // Broadcast typing event
                if (currentUser && activeChatTargetId) {
                  try {
                    supabase.channel(`chat_typing_${activeChatTargetId}`).send({
                      type: 'broadcast',
                      event: 'typing',
                      payload: { uid: currentUser.uid, name: currentUser.name }
                    });
                  } catch (_) {}
                }

                // Mention autocomplete trigger
                const lastWord = val.split(' ').pop();
                if (lastWord && lastWord.startsWith('@')) {
                  setShowMentionMenu(true);
                  setMentionQuery(lastWord.substring(1).toLowerCase());
                } else {
                  setShowMentionMenu(false);
                }
              }}
              onKeyDown={e => { 
                if (e.key === 'Enter') {
                  setShowMentionMenu(false);
                  handleSendChat();
                } 
              }}
              disabled={!canPostInChannel}
              placeholder={canPostInChannel ? `Type a message in ${activeDisplayTitle}... (Use @ to mention)` : "📢 Only teachers & admins can post in this channel"}
              className="flex-1 bg-slate-950 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />

            {/* Send Button */}
            <button
              onClick={handleSendChat}
              disabled={!canPostInChannel || (!newChatText.trim() && attachedFiles.length === 0)}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2.5 rounded-2xl font-bold transition-all shadow-lg active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* MEMBER PUBLIC PROFILE MODAL */}
      {selectedProfileUser && (
        <PublicProfileModal
          user={selectedProfileUser}
          currentUserId={currentUser?.uid || (currentUser as any)?.id}
          onClose={() => setSelectedProfileUser(null)}
          onStartDirectMessage={(user) => {
            setSelectedProfileUser(null);
            handleStartDirectMessage(user);
          }}
          onStartCall={(user, isVideo) => {
            setSelectedProfileUser(null);
            handleStartCall(user, isVideo ? 'video' : 'audio');
          }}
        />
      )}

      {/* VOICE & VIDEO CALL OVERLAY MODAL */}
      {activeCall && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col items-center space-y-6">
            
            {/* Header */}
            <div className="text-center space-y-1">
              <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                {activeCall.type === 'video' ? '📹 Video Call' : '📞 Voice Call'} • {activeCall.mode.toUpperCase()}
              </span>
              <h3 className="text-xl font-black text-white mt-2">{activeCall.targetUser.name}</h3>
              <p className="text-xs text-emerald-400 font-mono font-bold">
                {activeCall.mode === 'connected' ? `Connected (${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')})` : 'Ringing...'}
              </p>
            </div>

            {/* Video or Avatar Display */}
            <div className="w-full h-56 bg-slate-950 rounded-2xl border border-white/10 flex items-center justify-center relative overflow-hidden">
              {activeCall.type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-indigo-950/40">
                  <Video className="w-16 h-16 text-indigo-400/40 animate-pulse" />
                  <span className="absolute bottom-3 left-3 text-[10px] text-slate-400 bg-slate-900/80 px-2 py-1 rounded-md">
                    Camera Stream Active
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-24 h-24 rounded-full bg-indigo-600/30 border-4 border-indigo-500/50 flex items-center justify-center animate-pulse">
                    <span className="text-3xl font-black text-white">{activeCall.targetUser.name.charAt(0)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Incoming Call Answer/Reject Buttons */}
            {activeCall.mode === 'incoming' ? (
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => {
                    setActiveCall(prev => prev ? { ...prev, mode: 'connected', startTime: Date.now() } : null);
                    try {
                      supabase.channel(`room_channel_${activeChatTargetId}`).send({
                        type: 'broadcast',
                        event: 'call_accepted',
                        payload: { callId: activeCall.callId }
                      });
                    } catch (_) {}
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl text-xs uppercase flex items-center justify-center gap-2 shadow-lg"
                >
                  <Phone className="w-4 h-4" />
                  Accept Call
                </button>
                <button
                  onClick={handleEndCall}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-2xl text-xs uppercase flex items-center justify-center gap-2 shadow-lg"
                >
                  <PhoneOff className="w-4 h-4" />
                  Decline
                </button>
              </div>
            ) : (
              /* Active Controls */
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setActiveCall(prev => prev ? { ...prev, isMuted: !prev.isMuted } : null)}
                  className={`p-3.5 rounded-2xl border transition-all ${activeCall.isMuted ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-800 text-slate-300 border-white/10'}`}
                  title={activeCall.isMuted ? "Unmute" : "Mute"}
                >
                  {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {activeCall.type === 'video' && (
                  <button
                    onClick={() => setActiveCall(prev => prev ? { ...prev, isVideoOff: !prev.isVideoOff } : null)}
                    className={`p-3.5 rounded-2xl border transition-all ${activeCall.isVideoOff ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-800 text-slate-300 border-white/10'}`}
                    title={activeCall.isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                  >
                    {activeCall.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>
                )}

                <button
                  onClick={handleEndCall}
                  className="p-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl shadow-xl transition-all"
                  title="End Call"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* START NEW DIRECT MESSAGE MODAL */}
      {showNewDmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowNewDmModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-400" />
              <h3 className="text-base font-black text-white">Start Direct Message</h3>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                placeholder="Search by Name, Email, Phone, or Role..."
                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {availableUsersList
                .filter(u => u.uid !== currentUser?.uid)
                .filter(u => {
                  if (!userSearchQuery) return true;
                  const q = userSearchQuery.toLowerCase();
                  return u.name.toLowerCase().includes(q) || 
                         u.email.toLowerCase().includes(q) || 
                         (u.phone && u.phone.includes(q)) ||
                         u.role.toLowerCase().includes(q);
                })
                .map(user => (
                  <button
                    key={user.uid}
                    onClick={() => handleStartDirectMessage(user)}
                    className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-slate-950 border border-white/5 hover:border-teal-500/40 rounded-xl flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      {user.avatar || user.photoURL ? (
                        <img src={user.avatar || user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-teal-600/30 text-teal-300 font-bold text-xs flex items-center justify-center border border-teal-500/30">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-white">{user.name}</h4>
                        <p className="text-[10px] text-slate-400">{user.email || user.role}</p>
                      </div>
                    </div>
                    <span className="text-[9px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full font-bold">
                      Chat
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / JOIN GROUP MODAL */}
      {isCreatingRoom && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsCreatingRoom(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-black text-white">Create or Join Group Room</h3>

            {/* Join via Code */}
            <form onSubmit={handleJoinRoom} className="space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-white/5">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Join Existing Group</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinRoomCode}
                  onChange={e => setJoinRoomCode(e.target.value)}
                  placeholder="Enter 6-digit Code"
                  className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white uppercase"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase"
                >
                  Join
                </button>
              </div>
            </form>

            <div className="text-center text-[10px] text-slate-500 uppercase font-black">OR</div>

            {/* Create New Group */}
            <form onSubmit={handleCreateRoomSubmit} className="space-y-3 bg-slate-950/60 p-3.5 rounded-2xl border border-white/5">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Create New Group</h4>
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Room Icon & Name</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={newRoomIcon}
                    onChange={e => setNewRoomIcon(e.target.value)}
                    className="w-12 bg-slate-900 border border-white/10 rounded-xl px-2 py-2 text-center text-sm text-white"
                  />
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    placeholder="Group Name"
                    required
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Description</label>
                <textarea
                  value={newRoomDescription}
                  onChange={e => setNewRoomDescription(e.target.value)}
                  placeholder="What is this group for?"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white h-16 mt-1"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase"
              >
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Group Settings Modal */}
      {showGroupSettings && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 max-h-[85vh] overflow-y-auto scrollbar-thin">
            <button
              onClick={() => setShowGroupSettings(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <span className="text-3xl p-2 bg-slate-950 border border-white/10 rounded-2xl">{activeRoomInfo.icon}</span>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  {activeRoomInfo.name}
                  {isModerator && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">Admin/Mod</span>}
                </h3>
                <p className="text-xs text-slate-400">{activeRoomInfo.description || 'No description provided'}</p>
              </div>
            </div>

            {/* Editable Room Info (Moderators / Admins) */}
            {isModerator && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const updated: ChatRoom = {
                    ...activeRoomInfo,
                    name: editRoomName.trim() || activeRoomInfo.name,
                    description: editRoomDescription.trim(),
                    icon: editRoomIcon.trim() || activeRoomInfo.icon
                  };
                  setChatRooms(prev => prev.map(r => r.id === updated.id ? updated : r));
                  await saveChatRoom(updated);
                  showNotification('Room details updated!');
                }}
                className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-white/5"
              >
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Room Information</h4>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Room Icon & Name</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={editRoomIcon}
                      onChange={e => setEditRoomIcon(e.target.value)}
                      className="w-12 bg-slate-900 border border-white/10 rounded-xl px-2 py-2 text-center text-sm text-white"
                    />
                    <input
                      type="text"
                      value={editRoomName}
                      onChange={e => setEditRoomName(e.target.value)}
                      required
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Description</label>
                  <textarea
                    value={editRoomDescription}
                    onChange={e => setEditRoomDescription(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white h-16 mt-1"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl text-xs uppercase"
                >
                  Save Room Details
                </button>
              </form>
            )}

            {/* Invite Code Section */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Invite Code</span>
                {isModerator && (
                  <button
                    onClick={async () => {
                      const newCode = await regenerateRoomCode(activeRoomInfo);
                      setChatRooms(prev => prev.map(r => r.id === activeRoomInfo.id ? { ...r, code: newCode } : r));
                      showNotification(`Invite code regenerated: ${newCode}`);
                    }}
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    Regenerate Code
                  </button>
                )}
              </div>
              <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-white/10">
                <span className="font-mono text-emerald-400 font-black text-lg tracking-widest">{activeRoomInfo.code || 'GLOBAL'}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeRoomInfo.code || 'GLOBAL');
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedLink ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
            </div>

            {/* Members List Section */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex justify-between items-center">
                <span>Members ({(activeRoomInfo.members || []).length || 1})</span>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                {(activeRoomInfo.members || []).map(memberUid => {
                  const memberUser = resolveUser(memberUid);
                  const memberName = memberUid === currentUser?.uid ? `${memberUser.name} (You)` : memberUser.name;
                  const isOwner = activeRoomInfo.creatorId === memberUid;
                  const isMod = activeRoomInfo.moderators?.includes(memberUid) || isOwner;

                  return (
                    <div key={memberUid} className="flex justify-between items-center p-2.5 bg-slate-900 rounded-xl border border-white/5 text-xs text-white">
                      <button
                        onClick={() => setSelectedProfileUser(memberUser)}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                      >
                        {memberUser.avatar || memberUser.photoURL ? (
                          <img src={memberUser.avatar || memberUser.photoURL} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                            {memberName.charAt(0)}
                          </span>
                        )}
                        <span className="font-semibold">{memberName}</span>
                        {isOwner && <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">Owner</span>}
                        {isMod && !isOwner && <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-bold">Mod</span>}
                      </button>

                      {isModerator && memberUid !== currentUser?.uid && !isOwner && (
                        <div className="flex gap-1.5">
                          {!isMod && (
                            <button
                              onClick={async () => {
                                const updated = {
                                  ...activeRoomInfo,
                                  moderators: [...(activeRoomInfo.moderators || []), memberUid]
                                };
                                setChatRooms(prev => prev.map(r => r.id === updated.id ? updated : r));
                                await saveChatRoom(updated);
                                showNotification(`Promoted ${memberUser.name} to moderator.`);
                              }}
                              className="text-[10px] bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 px-2 py-1 rounded-lg font-bold"
                            >
                              Make Mod
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              const updated = {
                                ...activeRoomInfo,
                                members: (activeRoomInfo.members || []).filter(m => m !== memberUid),
                                moderators: (activeRoomInfo.moderators || []).filter(m => m !== memberUid)
                              };
                              setChatRooms(prev => prev.map(r => r.id === updated.id ? updated : r));
                              await saveChatRoom(updated);
                              showNotification(`Removed ${memberUser.name} from room.`);
                            }}
                            className="text-[10px] bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 px-2 py-1 rounded-lg font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Danger Zone Actions */}
            <div className="border-t border-white/10 pt-4 space-y-2">
              {activeRoomInfo.id !== 'group-all' && (
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      if (!currentUser) return;
                      await leaveChatRoom(activeRoomInfo.id, currentUser.uid);
                      setChatRooms(prev => prev.filter(r => r.id !== activeRoomInfo.id));
                      setActiveChatTargetId('group-all');
                      setShowGroupSettings(false);
                      showNotification(`Left ${activeRoomInfo.name}`);
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    Leave Room
                  </button>

                  {(isModerator || activeRoomInfo.creatorId === currentUser?.uid) && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to delete room "${activeRoomInfo.name}"? This cannot be undone.`)) return;
                        await deleteChatRoom(activeRoomInfo.id, currentUser?.uid);
                        setChatRooms(prev => prev.filter(r => r.id !== activeRoomInfo.id));
                        setActiveChatTargetId('group-all');
                        setShowGroupSettings(false);
                        showNotification(`Deleted room ${activeRoomInfo.name}`);
                      }}
                      className="flex-1 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      Delete Room
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-4 text-center">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-black text-white flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-indigo-400" />
              Group Invite Code
            </h3>

            <div className="p-6 bg-white rounded-2xl flex items-center justify-center shadow-inner my-2">
              <div className="text-center space-y-2">
                <span className="text-4xl">📱</span>
                <p className="font-mono text-2xl font-black text-slate-900 tracking-widest">{activeRoomInfo.code || 'GLOBAL'}</p>
                <p className="text-[10px] text-slate-500 font-semibold">Scan or Share code to join</p>
              </div>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(activeRoomInfo.code || 'GLOBAL');
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg"
            >
              <Copy className="w-4 h-4" />
              {copiedLink ? 'Code Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>
      )}

      {/* FORWARDING MODAL */}
      {forwardingMsg && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setForwardingMsg(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Forward className="w-4 h-4 text-indigo-400" />
              Forward Message
            </h3>

            <div className="p-3 bg-slate-950 rounded-xl border border-white/10 text-xs text-slate-300 italic">
              "{forwardingMsg.message}"
            </div>

            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select destination room:</p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {chatRooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => handleForwardMessage(room.id)}
                  className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/40 rounded-xl flex items-center justify-between transition-all text-xs text-white"
                >
                  <span className="font-bold flex items-center gap-2">
                    <span>{room.icon}</span>
                    <span>{room.name}</span>
                  </span>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase">Send</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>

  {/* ACTIVE VOICE & VIDEO CALL MODAL OVERLAY */}
      {activeCall && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-6 text-center">
            
            {/* User Avatar & Call Status */}
            <div className="space-y-3">
              <div className="relative inline-block">
                {activeCall.targetUser.avatar || activeCall.targetUser.photoURL ? (
                  <img
                    src={activeCall.targetUser.avatar || activeCall.targetUser.photoURL}
                    alt=""
                    className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-indigo-500/40 shadow-2xl"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-3xl flex items-center justify-center mx-auto shadow-2xl border-2 border-white/20">
                    {activeCall.targetUser.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {activeCall.mode === 'incoming' && (
                  <span className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full animate-ping" />
                )}
              </div>

              <div>
                <h3 className="text-lg font-black text-white">{activeCall.targetUser.name}</h3>
                <p className="text-xs text-indigo-400 font-mono font-bold flex items-center justify-center gap-1 mt-1">
                  {activeCall.type === 'video' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                  {activeCall.type === 'video' ? 'Direct Video Call' : 'Direct Voice Call'}
                </p>
                
                {/* Mode status text / duration */}
                <p className="text-xs text-slate-400 font-mono mt-2">
                  {activeCall.mode === 'incoming' && 'Incoming Call...'}
                  {activeCall.mode === 'outgoing' && 'Ringing...'}
                  {activeCall.mode === 'connected' && (
                    <span className="text-emerald-400 font-black">
                      Connected • {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Video preview area when video call connected */}
            {activeCall.type === 'video' && activeCall.mode === 'connected' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 aspect-video bg-slate-950 rounded-2xl overflow-hidden relative border border-white/10 p-2">
                {/* Remote Video Stream */}
                <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-mono text-white font-bold">
                    {activeCall.targetUser.name}'s Video
                  </span>
                </div>

                {/* Local Video Stream */}
                <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-mono text-white font-bold">
                    You
                  </span>
                </div>
              </div>
            )}

            {/* Hidden Audio element for remote audio stream playback */}
            <audio ref={remoteAudioRef} autoPlay playsInline />

            {/* Controls based on Call Mode */}
            <div className="pt-2">
              {activeCall.mode === 'incoming' ? (
                <div className="flex items-center justify-center gap-6">
                  {/* Reject Call */}
                  <button
                    onClick={() => {
                      try {
                        const payload = { callId: activeCall.callId };
                        supabase.channel(`room_channel_${activeChatTargetId}`).send({
                          type: 'broadcast',
                          event: 'call_rejected',
                          payload
                        });
                        if (activeCall.targetUser?.uid) {
                          supabase.channel(`user_calls_${activeCall.targetUser.uid}`).send({
                            type: 'broadcast',
                            event: 'call_rejected',
                            payload
                          });
                        }
                      } catch (_) {}
                      cleanupCall();
                      showNotification('Call declined.');
                    }}
                    className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-all hover:scale-110"
                    title="Decline Call"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>

                  {/* Accept Call */}
                  <button
                    onClick={async () => {
                      stopRingtoneSound();
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({
                          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                          video: activeCall.type === 'video' ? { width: 1280, height: 720 } : false
                        });
                        localMediaStreamRef.current = stream;
                      } catch (e) {
                        console.warn('Media access warning during call accept', e);
                      }

                      try {
                        const payload = { callId: activeCall.callId };
                        supabase.channel(`room_channel_${activeChatTargetId}`).send({
                          type: 'broadcast',
                          event: 'call_accepted',
                          payload
                        });
                        if (activeCall.targetUser?.uid) {
                          supabase.channel(`user_calls_${activeCall.targetUser.uid}`).send({
                            type: 'broadcast',
                            event: 'call_accepted',
                            payload
                          });
                        }
                      } catch (_) {}

                      setActiveCall(prev => prev ? { ...prev, mode: 'connected', startTime: Date.now(), isCaller: false } : null);
                      showNotification('Call connected!');
                    }}
                    className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition-all hover:scale-110 animate-bounce"
                    title="Accept Call"
                  >
                    <Phone className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  {activeCall.mode === 'connected' && (
                    <>
                      {/* Mic Toggle */}
                      <button
                        onClick={() => {
                          const next = !activeCall.isMuted;
                          if (localMediaStreamRef.current) {
                            localMediaStreamRef.current.getAudioTracks().forEach(t => t.enabled = !next);
                          }
                          setActiveCall(prev => prev ? { ...prev, isMuted: next } : null);
                        }}
                        className={`p-3.5 rounded-2xl transition-all ${activeCall.isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                        title="Toggle Mic"
                      >
                        {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>

                      {/* Video Toggle */}
                      {activeCall.type === 'video' && (
                        <button
                          onClick={() => {
                            const next = !activeCall.isVideoOff;
                            if (localMediaStreamRef.current) {
                              localMediaStreamRef.current.getVideoTracks().forEach(t => t.enabled = !next);
                            }
                            setActiveCall(prev => prev ? { ...prev, isVideoOff: next } : null);
                          }}
                          className={`p-3.5 rounded-2xl transition-all ${activeCall.isVideoOff ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                          title="Toggle Video"
                        >
                          {activeCall.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                        </button>
                      )}
                    </>
                  )}

                  {/* End / Cancel Call */}
                  <button
                    onClick={handleEndCall}
                    className="px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-600/30 flex items-center gap-2 text-xs uppercase transition-all"
                  >
                    <PhoneOff className="w-4 h-4" />
                    {activeCall.mode === 'outgoing' ? 'Cancel Call' : 'End Call'}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MOBILE LONG PRESS ACTION SHEET MODAL */}
      {mobileSelectedMsg && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-end justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setMobileSelectedMsg(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Message preview */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-white/10 text-xs text-slate-200 font-medium max-h-24 overflow-y-auto">
              <p className="font-bold text-indigo-400 text-[10px] uppercase mb-0.5">{mobileSelectedMsg.name}</p>
              <p className="line-clamp-2">{mobileSelectedMsg.message}</p>
            </div>

            {/* Quick Reactions Bar */}
            <div className="flex items-center justify-around bg-slate-950/80 p-2.5 rounded-2xl border border-white/10">
              {['👍', '❤️', '😂', '😮', '🎉'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleAddReaction(mobileSelectedMsg.id, emoji);
                    setMobileSelectedMsg(null);
                  }}
                  className="text-2xl hover:scale-125 transition-transform active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Options list */}
            <div className="space-y-1.5 pt-1">
              <button
                onClick={() => {
                  setReplyingTo(mobileSelectedMsg);
                  setMobileSelectedMsg(null);
                }}
                className="w-full p-2.5 bg-slate-950/60 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-3"
              >
                <Reply className="w-4 h-4 text-indigo-400" />
                <span>Reply</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(mobileSelectedMsg.message);
                  showNotification('Message copied!');
                  setMobileSelectedMsg(null);
                }}
                className="w-full p-2.5 bg-slate-950/60 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-3"
              >
                <Copy className="w-4 h-4 text-emerald-400" />
                <span>Copy Text</span>
              </button>

              <button
                onClick={() => {
                  handleTogglePin(mobileSelectedMsg.id);
                  setMobileSelectedMsg(null);
                }}
                className="w-full p-2.5 bg-slate-950/60 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-3"
              >
                <Pin className="w-4 h-4 text-amber-400" />
                <span>Pin / Unpin Message</span>
              </button>

              <button
                onClick={() => {
                  setForwardingMsg(mobileSelectedMsg);
                  setMobileSelectedMsg(null);
                }}
                className="w-full p-2.5 bg-slate-950/60 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-3"
              >
                <Forward className="w-4 h-4 text-sky-400" />
                <span>Forward Message</span>
              </button>

              {mobileSelectedMsg.senderId === currentUser?.uid && (
                <button
                  onClick={() => {
                    setEditingMsgId(mobileSelectedMsg.id);
                    setEditText(mobileSelectedMsg.message);
                    setMobileSelectedMsg(null);
                  }}
                  className="w-full p-2.5 bg-slate-950/60 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-3"
                >
                  <Edit3 className="w-4 h-4 text-indigo-400" />
                  <span>Edit Message</span>
                </button>
              )}

              {(mobileSelectedMsg.senderId === currentUser?.uid || isModerator) && (
                <button
                  onClick={() => {
                    handleDeleteMessage(mobileSelectedMsg.id, true);
                    setMobileSelectedMsg(null);
                  }}
                  className="w-full p-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-400 flex items-center gap-3"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Delete Message</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
