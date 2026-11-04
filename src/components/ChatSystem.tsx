import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Image as ImageIcon, Paperclip, Mic, MicOff, Square, Smile, Reply, Forward, 
  Trash2, Edit3, Pin, Shield, QrCode, UserPlus, LogOut, Settings, X, Search, 
  CheckCheck, Check, Volume2, VolumeX, Video, VideoOff, Phone, PhoneOff, PhoneIncoming, PhoneOutgoing,
  AlertTriangle, Info, Sparkles, Filter, Bell, Copy, Link, Eye, UserCheck, Flame, ThumbsUp, Heart,
  Trophy, Megaphone, BookOpen, Users, Hash, MoreHorizontal, ArrowLeft, Monitor, User as UserIcon,
  ShieldCheck, Download, Plus, Globe, ChevronDown, ChevronRight, MessageSquare, AtSign, Radio, Clock, ShieldAlert, Award
} from 'lucide-react';
import { 
  ChatMessage, ChatRoom, UserRole, HouseType, ChatAttachment, UserProfile,
  ChatServer, ServerChannel, CustomRole, ServerMember, MessageReadReceiptDetail 
} from '../types';
import { moderateChatMessage } from '../lib/aiModeration';
import { 
  savePeerMessage, deletePeerMessage, saveChatRoom, joinChatRoom, leaveChatRoom, 
  deleteChatRoom, regenerateRoomCode, getPeerMessages, getAllUserProfiles, getOrCreateDirectMessageRoom,
  getChatServers, saveChatServer, createChatServerChannel, deleteChatServerChannel,
  saveCustomRole, deleteCustomRole, markMessageAsRead, getMessageReadReceipts, DEFAULT_SERVERS, joinChatServer,
  deleteChatServer, transferServerOwnership, muteServerMember, removeServerMember
} from '../lib/supabaseChat';
import { saveAppNotification } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { sendRealtimeEvent, subscribeRealtimeEvents } from '../lib/wsHelper';
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
  mode: 'outgoing' | 'incoming' | 'connecting' | 'connected';
  startTime?: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isCaller?: boolean;
  connectionStatus?: string;
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

  // Load Discord-style servers
  useEffect(() => {
    let isMounted = true;
    const fetchServers = async () => {
      try {
        const sList = await getChatServers();
        if (isMounted) setChatServers(sList);
      } catch (e) {
        console.warn('Failed to load chat servers:', e);
      }
    };
    fetchServers();

    const unsub = subscribeRealtimeEvents('student-os-public', {
      server_updated: () => {
        fetchServers();
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  // Update read receipts when active room messages change
  useEffect(() => {
    if (!activeChatTargetId || !currentUser?.uid) return;
    const targetRoomMessages = chats.filter(c => c.targetId === activeChatTargetId);
    if (targetRoomMessages.length > 0) {
      const lastMsg = targetRoomMessages[targetRoomMessages.length - 1];
      markMessageAsRead(lastMsg.id, {
        uid: currentUser.uid,
        name: currentUser.name || 'Member',
        avatar: currentUser.avatar || currentUser.photoURL,
        role: currentUser.role
      });
    }
  }, [activeChatTargetId, chats.length, currentUser?.uid]);

  const getStatusColor = (uid: string) => {
    const presence = onlineUsersMap.get(uid);
    if (!presence) return 'bg-slate-500';
    const status = presence.status;
    if (status === 'online') return 'bg-emerald-400';
    if (status === 'idle') return 'bg-amber-400';
    if (status === 'dnd') return 'bg-rose-500';
    return 'bg-slate-500';
  };

  const handleUpdatePresence = (status: 'online' | 'idle' | 'dnd' | 'offline') => {
    setMyPresenceStatus(status);
    presenceService.updateStatus(status);
    setShowPresencePicker(false);
    showNotification(`Presence updated to ${status.toUpperCase()}`);
  };

  const handleOpenReceiptsModal = async (msg: ChatMessage) => {
    setReceiptsModalMsg(msg);
    setReceiptsLoading(true);
    try {
      const activeRoom = chatRooms.find(r => r.id === activeChatTargetId);
      const members = activeRoom?.members || [];
      const res = await getMessageReadReceipts(msg.id, members);
      setReceiptsData(res);
    } catch (e) {
      console.warn('Failed to fetch receipts:', e);
    } finally {
      setReceiptsLoading(false);
    }
  };

  const handleCreateServer = async () => {
    if (!newServerName.trim()) return;
    const sId = `server_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newServer: ChatServer = {
      id: sId,
      name: newServerName.trim(),
      icon: newServerIcon || '🏰',
      description: newServerDesc.trim() || 'A vibrant StudentOS community guild.',
      ownerId: currentUser?.uid || 'guest',
      bannerUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80',
      channels: [
        {
          id: `channel_gen_${Date.now()}`,
          serverId: sId,
          name: '💬-general-chat',
          type: 'text',
          category: 'General',
          topic: 'General discussion and member chat.'
        }
      ],
      roles: [
        {
          id: `role_owner_${Date.now()}`,
          name: 'Guildmaster',
          color: '#f59e0b',
          priority: 100,
          permissions: {
            canSendMessages: true,
            canAttachFiles: true,
            canManageMessages: true,
            canManageChannels: true,
            canManageRoles: true
          }
        }
      ],
      members: [currentUser?.uid || 'guest'],
      createdAt: new Date().toISOString()
    };

    await saveChatServer(newServer);
    setChatServers(prev => [...prev, newServer]);
    setActiveServerId(newServer.id);
    setActiveChatTargetId(newServer.channels![0].id);
    setShowCreateServerModal(false);
    setNewServerName('');
    setNewServerDesc('');
    showNotification(`Created server "${newServer.name}"!`);
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    const currentServer = chatServers.find(s => s.id === activeServerId);
    if (!currentServer) return;

    const formattedName = newChannelName.toLowerCase().trim().replace(/\s+/g, '-');
    const channelId = `ch_${currentServer.id}_${Date.now()}`;
    
    // Choose prefix based on type if not already prefixed
    let finalName = formattedName;
    const prefix = newChannelType === 'announcement' ? '📢' : newChannelType === 'class' ? '💡' : '💬';
    if (!finalName.startsWith('📢') && !finalName.startsWith('💡') && !finalName.startsWith('💬') && !finalName.startsWith('#')) {
      finalName = `${prefix}-${finalName}`;
    }

    const channel: ServerChannel = {
      id: channelId,
      serverId: currentServer.id,
      name: finalName,
      type: newChannelType,
      category: newServerChannelCategory || 'General',
      topic: `${newServerChannelCategory || 'General'} channel in ${currentServer.name}`
    };

    // Update state immediately
    const updatedChannels = [...(currentServer.channels || []), channel];
    const updatedServer = { ...currentServer, channels: updatedChannels };
    setChatServers(prev => prev.map(s => s.id === currentServer.id ? updatedServer : s));

    try {
      await createChatServerChannel(currentServer.id, channel);
      setActiveChatTargetId(channel.id);
      setShowCreateChannelModal(false);
      setNewChannelName('');
      showNotification(`Created channel ${channel.name}!`);
    } catch (err: any) {
      showNotification(`Error saving channel: ${err?.message || err}`);
    }
  };

  const handleDeleteChannel = async (serverId: string, channelId: string) => {
    if (!confirm('Are you sure you want to delete this channel?')) return;
    await deleteChatServerChannel(serverId, channelId);
    const updated = await getChatServers();
    setChatServers(updated);
    const server = updated.find(s => s.id === serverId);
    if (server && server.channels && server.channels.length > 0) {
      setActiveChatTargetId(server.channels[0].id);
    } else {
      setActiveChatTargetId('group-all');
    }
    showNotification('Channel deleted.');
  };

  const handleSaveCustomRole = async () => {
    if (!newRoleName.trim()) return;
    const role: CustomRole = {
      id: `role_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newRoleName.trim(),
      color: newRoleColor,
      priority: Number(newRolePriority) || 50,
      permissions: newRolePerms
    };

    await saveCustomRole(rolesTargetId, role);
    const updatedServers = await getChatServers();
    setChatServers(updatedServers);
    setNewRoleName('');
    showNotification(`Saved role "${role.name}"!`);
  };

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

  // Discord-style Community Servers & Server Channels state
  const [chatServers, setChatServers] = useState<ChatServer[]>(DEFAULT_SERVERS);
  const [activeServerId, setActiveServerId] = useState<string>('home');
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerIcon, setNewServerIcon] = useState('🏰');
  const [newServerDesc, setNewServerDesc] = useState('');

  // Join Server State
  const [showJoinServerModal, setShowJoinServerModal] = useState(false);
  const [joinServerCodeInput, setJoinServerCodeInput] = useState('');
  const [joinServerError, setJoinServerError] = useState('');
  const [joinServerLoading, setJoinServerLoading] = useState(false);

  // Server Invite & Member Add State
  const [showServerInviteModal, setShowServerInviteModal] = useState(false);
  const [serverInviteSearchQuery, setServerInviteSearchQuery] = useState('');
  const [showServerMembersModal, setShowServerMembersModal] = useState(false);

  // Join Server Handler
  const handleJoinServerByCode = async (codeToJoin?: string) => {
    const targetCode = (codeToJoin || joinServerCodeInput).trim();
    if (!targetCode) {
      setJoinServerError('Please enter a valid server code.');
      return;
    }
    if (!currentUser?.uid) {
      setJoinServerError('You must be signed in to join servers.');
      return;
    }
    setJoinServerLoading(true);
    setJoinServerError('');

    try {
      const res = await joinChatServer(targetCode, currentUser.uid);
      setJoinServerLoading(false);

      if (res.success && res.server) {
        const updatedServers = await getChatServers();
        setChatServers(updatedServers);
        setActiveServerId(res.server.id);
        if (res.server.channels && res.server.channels.length > 0) {
          setActiveChatTargetId(res.server.channels[0].id);
        }
        setShowJoinServerModal(false);
        setJoinServerCodeInput('');
        showNotification(res.message || `Joined server "${res.server.name}"!`);
      } else {
        setJoinServerError(res.message || 'Server code not found.');
      }
    } catch (e) {
      setJoinServerLoading(false);
      setJoinServerError('Failed to join server. Please try again.');
    }
  };

  // Add Member to Server Handler
  const handleAddUserToServer = async (server: ChatServer, targetUser: UserProfile) => {
    if (!targetUser.uid) return;
    const currentMembers = server.members || [];
    if (currentMembers.includes(targetUser.uid)) {
      showNotification(`${targetUser.name} is already a member of ${server.name}!`);
      return;
    }

    const updatedMembers = [...currentMembers, targetUser.uid];
    const updatedServer = { ...server, members: updatedMembers };
    await saveChatServer(updatedServer);
    const updatedList = await getChatServers();
    setChatServers(updatedList);
    showNotification(`Added ${targetUser.name} to "${server.name}"!`);
  };

  // Server Channel Creation
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newServerChannelCategory, setNewServerChannelCategory] = useState<string>('General');
  const [newChannelType, setNewChannelType] = useState<'text' | 'announcement' | 'class'>('text');

  // Custom Roles & Permissions Management
  const [showManageRolesModal, setShowManageRolesModal] = useState(false);
  const [rolesTargetId, setRolesTargetId] = useState<string>('server_campus_main');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#6366f1');
  const [newRolePriority, setNewRolePriority] = useState(50);
  const [newRolePerms, setNewRolePerms] = useState({
    canSendMessages: true,
    canAttachFiles: true,
    canManageMessages: false,
    canManageChannels: false,
    canManageRoles: false
  });

  // Read Receipts & Unread Recipients Modal
  const [receiptsModalMsg, setReceiptsModalMsg] = useState<ChatMessage | null>(null);
  const [receiptsData, setReceiptsData] = useState<{ readBy: MessageReadReceiptDetail[]; unreadBy: string[] } | null>(null);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  // User Presence & Heartbeat Status Picker
  const [myPresenceStatus, setMyPresenceStatus] = useState<'online' | 'idle' | 'dnd' | 'offline'>('online');
  const [showPresencePicker, setShowPresencePicker] = useState(false);

  // Rich Community User Profile Modal
  const [communityProfileUser, setCommunityProfileUser] = useState<UserProfile | null>(null);

  // Voice & Video Calls State
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [homeSidebarTab, setHomeSidebarTab] = useState<'all' | 'dms' | 'groups'>('all');
  const [showMemberList, setShowMemberList] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'info' | 'members' | 'roles'>('info');
  const [showServerSettingsModal, setShowServerSettingsModal] = useState(false);
  const [serverSettingsTab, setServerSettingsTab] = useState<'info' | 'members' | 'roles'>('info');
  const [transferOwnerTargetUid, setTransferOwnerTargetUid] = useState('');
  const [showDeleteServerConfirm, setShowDeleteServerConfirm] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const callTimerRef = useRef<any>(null);
  const callTimeoutRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const localMediaStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);

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
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.onconnectionstatechange = null;
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
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setRemoteStream(null);
    stopRingtoneSound();
    setActiveCall(null);
    setCallDuration(0);
  };

  useEffect(() => {
    if (!activeCall) {
      stopRingtoneSound();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      return;
    }
    if (activeCall.mode === 'incoming') {
      startRingtoneSound('incoming');
    } else if (activeCall.mode === 'outgoing') {
      startRingtoneSound('outgoing');
      // 35s unanswered call timeout
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        if (activeCallRef.current && activeCallRef.current.mode === 'outgoing') {
          const cid = activeCallRef.current.callId;
          const tUid = activeCallRef.current.targetUser?.uid;
          sendRealtimeEvent(`room_channel_${activeChatTargetId}`, 'call_ended', { callId: cid, reason: 'timeout' });
          if (tUid) {
            sendRealtimeEvent(`user_calls_${tUid}`, 'call_ended', { callId: cid, reason: 'timeout' });
          }
          cleanupCall();
          showNotification('No answer. Call timed out.');
        }
      }, 35000);
    } else {
      stopRingtoneSound();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
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
    if (!activeCall || (activeCall.mode !== 'connecting' && activeCall.mode !== 'connected')) return;

    const callId = activeCall.callId;
    const channelId = `call_signal_${callId}`;
    let isDisposed = false;

    const flushPendingCandidates = async (pc: RTCPeerConnection) => {
      if (!pc.remoteDescription) return;
      while (pendingIceCandidatesRef.current.length > 0) {
        const cand = pendingIceCandidatesRef.current.shift();
        if (cand) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (err) {
            console.warn('[Call WebRTC] Buffered ICE candidate warning:', err);
          }
        }
      }
    };

    const sendOfferIfCaller = async () => {
      const pc = peerConnectionRef.current;
      if (!pc || !activeCallRef.current?.isCaller) return;
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: activeCallRef.current.type === 'video'
        });
        await pc.setLocalDescription(offer);
        sendRealtimeEvent(channelId, 'webrtc_signal', {
          offer: { type: offer.type, sdp: offer.sdp },
          senderUid: currentUser?.uid,
          callId
        });
      } catch (e) {
        console.warn('[Call WebRTC] Create offer warning:', e);
      }
    };

    const initiateWebRTC = async () => {
      if (peerConnectionRef.current) {
        try { peerConnectionRef.current.close(); } catch (_) {}
        peerConnectionRef.current = null;
      }
      pendingIceCandidatesRef.current = [];

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
        if (isDisposed) return;
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
        setActiveCall(prev => prev && prev.mode !== 'connected'
          ? { ...prev, mode: 'connected', startTime: prev.startTime || Date.now(), connectionStatus: 'Connected' }
          : prev
        );
      };

      pc.onconnectionstatechange = () => {
        if (isDisposed) return;
        const st = pc.connectionState;
        if (st === 'connected') {
          setActiveCall(prev => prev ? {
            ...prev,
            mode: 'connected',
            startTime: prev.startTime || Date.now(),
            connectionStatus: 'Connected'
          } : null);
        } else if (st === 'failed' || st === 'disconnected') {
          setActiveCall(prev => prev ? { ...prev, connectionStatus: 'Reconnecting...' } : null);
        }
      };

      pc.onicecandidate = (evt) => {
        if (evt.candidate && !isDisposed) {
          sendRealtimeEvent(channelId, 'webrtc_signal', {
            candidate: evt.candidate.toJSON ? evt.candidate.toJSON() : evt.candidate,
            senderUid: currentUser?.uid,
            callId
          });
        }
      };

      if (activeCall.isCaller) {
        await sendOfferIfCaller();
      } else {
        // Notify caller that callee's WebRTC peer connection is initialized and ready for offer
        sendRealtimeEvent(channelId, 'webrtc_signal', {
          ready: true,
          senderUid: currentUser?.uid,
          callId
        });
      }
    };

    const unsubscribeSignal = subscribeRealtimeEvents(channelId, {
      webrtc_signal: async (data: any) => {
        if (!data || data.senderUid === currentUser?.uid || isDisposed) return;
        const pc = peerConnectionRef.current;
        if (!pc) return;

        try {
          if (data.ready && activeCallRef.current?.isCaller) {
            await sendOfferIfCaller();
          } else if (data.offer && !activeCallRef.current?.isCaller) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            await flushPendingCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendRealtimeEvent(channelId, 'webrtc_signal', {
              answer: { type: answer.type, sdp: answer.sdp },
              senderUid: currentUser?.uid,
              callId
            });
            setActiveCall(prev => prev ? {
              ...prev,
              mode: 'connected',
              startTime: prev.startTime || Date.now(),
              connectionStatus: 'Connected'
            } : null);
          } else if (data.answer && activeCallRef.current?.isCaller) {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              await flushPendingCandidates(pc);
            }
            setActiveCall(prev => prev ? {
              ...prev,
              mode: 'connected',
              startTime: prev.startTime || Date.now(),
              connectionStatus: 'Connected'
            } : null);
          } else if (data.candidate) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
              pendingIceCandidatesRef.current.push(data.candidate);
            }
          }
        } catch (e) {
          console.warn('[Call WebRTC] Signal processing note:', e);
        }
      }
    });

    initiateWebRTC();

    return () => {
      isDisposed = true;
      unsubscribeSignal();
    };
  }, [activeCall?.callId, activeCall?.mode === 'connecting' || activeCall?.mode === 'connected']);

  // Helper to handle incoming call events consistently from any channel
  const handleIncomingCallSignal = useRef((eventType: string, data: any) => {
    if (!data || !currentUser?.uid) return;
    if (eventType === 'call_invite') {
      if (data.targetUid === currentUser.uid && data.callerUid !== currentUser.uid) {
        // If already in a different active call, send busy rejection
        if (activeCallRef.current && activeCallRef.current.callId !== data.callId) {
          sendRealtimeEvent(`user_calls_${data.callerUid}`, 'call_rejected', {
            callId: data.callId,
            reason: 'busy'
          });
          return;
        }
        const caller = data.callerProfile || resolveUser(data.callerUid);
        setActiveCall({
          callId: data.callId,
          targetUser: caller,
          type: data.callType || 'audio',
          mode: 'incoming',
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
          isCaller: false,
          connectionStatus: 'Incoming Call...'
        });
      }
    } else if (eventType === 'call_accepted') {
      if (activeCallRef.current && data.callId === activeCallRef.current.callId) {
        stopRingtoneSound();
        setActiveCall(prev => prev ? {
          ...prev,
          mode: 'connected',
          startTime: prev.startTime || Date.now(),
          connectionStatus: 'Connected'
        } : null);
        showNotification('Call connected!');
      }
    } else if (eventType === 'call_rejected') {
      if (activeCallRef.current && data.callId === activeCallRef.current.callId) {
        cleanupCall();
        showNotification(data.reason === 'busy' ? 'User is busy on another call.' : 'Call declined.');
      }
    } else if (eventType === 'call_ended') {
      if (activeCallRef.current && data.callId === activeCallRef.current.callId) {
        cleanupCall();
        showNotification('Call ended.');
      }
    }
  });

  useEffect(() => {
    handleIncomingCallSignal.current = (eventType: string, data: any) => {
      if (!data || !currentUser?.uid) return;
      if (eventType === 'call_invite') {
        if (data.targetUid === currentUser.uid && data.callerUid !== currentUser.uid) {
          if (activeCallRef.current && activeCallRef.current.callId !== data.callId) {
            sendRealtimeEvent(`user_calls_${data.callerUid}`, 'call_rejected', {
              callId: data.callId,
              reason: 'busy'
            });
            return;
          }
          const caller = data.callerProfile || resolveUser(data.callerUid);
          setActiveCall({
            callId: data.callId,
            targetUser: caller,
            type: data.callType || 'audio',
            mode: 'incoming',
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            isCaller: false,
            connectionStatus: 'Incoming Call...'
          });
        }
      } else if (eventType === 'call_accepted') {
        if (activeCallRef.current && data.callId === activeCallRef.current.callId) {
          stopRingtoneSound();
          setActiveCall(prev => prev ? {
            ...prev,
            mode: 'connected',
            startTime: prev.startTime || Date.now(),
            connectionStatus: 'Connected'
          } : null);
          showNotification('Call connected!');
        }
      } else if (eventType === 'call_rejected') {
        if (activeCallRef.current && data.callId === activeCallRef.current.callId) {
          cleanupCall();
          showNotification(data.reason === 'busy' ? 'User is busy on another call.' : 'Call declined.');
        }
      } else if (eventType === 'call_ended') {
        if (activeCallRef.current && data.callId === activeCallRef.current.callId) {
          cleanupCall();
          showNotification('Call ended.');
        }
      }
    };
  }, [currentUser?.uid, showNotification]);

  // Global Call Realtime Listener for Direct Calls
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubscribeUserCalls = subscribeRealtimeEvents(`user_calls_${currentUser.uid}`, {
      call_invite: (data) => handleIncomingCallSignal.current('call_invite', data),
      call_accepted: (data) => handleIncomingCallSignal.current('call_accepted', data),
      call_rejected: (data) => handleIncomingCallSignal.current('call_rejected', data),
      call_ended: (data) => handleIncomingCallSignal.current('call_ended', data),
    });
    return () => {
      unsubscribeUserCalls();
    };
  }, [currentUser?.uid]);

  // Active Room Realtime Subscription Hook
  useEffect(() => {
    if (!activeChatTargetId) return;

    const channelName = `room_channel_${activeChatTargetId}`;
    const unsubscribeRoom = subscribeRealtimeEvents(channelName, {
      new_chat_message: (payload) => {
        if (payload) {
          const newMsg = payload as ChatMessage;
          if (newMsg.ownerUid !== currentUser?.uid) {
            const isServerChannel = activeChatTargetId.startsWith('ch_') || (activeServerId && activeServerId !== 'home');
            if (isServerChannel) {
              soundService.playServerMessageSound();
            } else {
              soundService.playDirectMessageSound();
            }
          }
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
      },
      call_invite: (data) => handleIncomingCallSignal.current('call_invite', data),
      call_accepted: (data) => handleIncomingCallSignal.current('call_accepted', data),
      call_rejected: (data) => handleIncomingCallSignal.current('call_rejected', data),
      call_ended: (data) => handleIncomingCallSignal.current('call_ended', data),
    });

    return () => {
      unsubscribeRoom();
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

  // Prevent native context menu on message bubbles while keeping inputs selectable
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('.message-bubble')) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu, { passive: false });
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Message interaction states
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);
  const [activeMenuMsg, setActiveMenuMsg] = useState<ChatMessage | null>(null);
  const [activeMediaPreview, setActiveMediaPreview] = useState<{ type: 'image' | 'video'; url: string; name: string } | null>(null);
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
    if (!targetUser?.uid || targetUser.uid === currentUser.uid) {
      showNotification('Cannot place a call to yourself.');
      return;
    }
    cleanupCall(); // Ensure previous peer connections/tracks are destroyed

    const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      });
      localMediaStreamRef.current = stream;
    } catch (e) {
      console.warn('Microphone/Camera access note during call start', e);
      showNotification('Note: Camera/Mic permission denied or unavailable. Proceeding in listen-only mode.');
    }

    setActiveCall({
      callId,
      targetUser,
      type,
      mode: 'outgoing',
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      isCaller: true,
      connectionStatus: 'Calling...'
    });

    const payload = {
      callId,
      callerUid: currentUser.uid,
      callerProfile: {
        uid: currentUser.uid,
        name: currentUser.name,
        role: currentUser.role,
        email: currentUser.email,
        avatar: currentUser.avatar
      },
      targetUid: targetUser.uid,
      callType: type
    };

    sendRealtimeEvent(`room_channel_${activeChatTargetId}`, 'call_invite', payload);
    sendRealtimeEvent(`user_calls_${targetUser.uid}`, 'call_invite', payload);

    showNotification(`Calling ${targetUser.name}...`);
  };

  // End Call
  const handleEndCall = () => {
    if (activeCall) {
      const payload = { callId: activeCall.callId, senderUid: currentUser?.uid };
      sendRealtimeEvent(`room_channel_${activeChatTargetId}`, 'call_ended', payload);
      if (activeCall.targetUser?.uid) {
        sendRealtimeEvent(`user_calls_${activeCall.targetUser.uid}`, 'call_ended', payload);
      }
    }
    cleanupCall();
    showNotification('Call ended.');
  };

  // Send Chat Message
  const handleSendChat = async () => {
    if ((!newChatText.trim() && attachedFiles.length === 0) || !currentUser) return;

    const currentServer = chatServers.find(s => s.id === activeServerId);
    if (currentServer) {
      if (currentServer.mutedMembers?.includes(currentUser.uid)) {
        showNotification('You are muted in this server and cannot send messages.');
        return;
      }
      if (!currentServer.members?.includes(currentUser.uid) && currentServer.ownerId !== currentUser.uid) {
        showNotification('You must join this server to send messages.');
        return;
      }
    }

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
    soundService.playToggle(true);

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
      const currentServer = chatServers.find(s => s.id === activeServerId);
      const isOwnerOrAdmin = currentServer && (currentServer.ownerId === currentUser?.uid || currentUser?.role === 'admin' || currentUser?.role === 'super_admin');
      const targetMsg = chats.find(c => c.id === msgId);
      const isMine = targetMsg?.ownerUid === currentUser?.uid;

      if (!isMine && !isOwnerOrAdmin) {
        showNotification('Only the server owner or message author can delete this message.');
        return;
      }

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

  // Add / Remove Reaction
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    if (!currentUser) return;
    
    setChats(prev => prev.map(msg => {
      if (msg.id !== msgId) return msg;
      
      const currentReactions = { ...(msg.reactions || {}) };
      const users = [...(currentReactions[emoji] || [])];
      
      if (users.includes(currentUser.uid)) {
        // Remove reaction
        currentReactions[emoji] = users.filter(u => u !== currentUser.uid);
        if (currentReactions[emoji].length === 0) delete currentReactions[emoji];
      } else {
        // Add reaction
        currentReactions[emoji] = [...users, currentUser.uid];
      }
      
      const updated = { ...msg, reactions: currentReactions };
      savePeerMessage(updated).catch(console.error);
      return updated;
    }));
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

    const code = joinRoomCode.trim().toUpperCase();

    // Try joining a standard chat room first
    const roomRes = await joinChatRoom(code, currentUser.uid);
    if (roomRes.success && roomRes.room) {
      setChatRooms(prev => {
        if (prev.some(r => r.id === roomRes.room!.id)) return prev;
        return [...prev, roomRes.room!];
      });
      setActiveChatTargetId(roomRes.room.id);
      setJoinRoomCode('');
      setIsCreatingRoom(false);
      showNotification(roomRes.alreadyJoined ? `Already joined ${roomRes.room.name}` : `Joined room: ${roomRes.room.name}`);
      return;
    }

    // If not a room, try joining a server
    const serverRes = await joinChatServer(code, currentUser.uid);
    if (serverRes.success && serverRes.server) {
      setChatServers(prev => {
        if (prev.some(s => s.id === serverRes.server!.id)) return prev;
        return [...prev, serverRes.server!];
      });
      setActiveServerId(serverRes.server.id);
      if (serverRes.server.channels && serverRes.server.channels.length > 0) {
        setActiveChatTargetId(serverRes.server.channels[0].id);
      }
      setJoinRoomCode('');
      setIsCreatingRoom(false);
      showNotification(serverRes.message);
      return;
    }

    showNotification(roomRes.message || serverRes.message || 'Invite code not found or invalid.');
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

  // Resolve Server Channel if an active server channel is selected or if activeServerId is not home
  let activeServerChannel: ServerChannel | null = null;
  let activeParentServer: ChatServer | null = null;

  if (activeServerId !== 'home') {
    activeParentServer = chatServers.find(s => s.id === activeServerId) || null;
    if (activeParentServer && activeParentServer.channels) {
      activeServerChannel = activeParentServer.channels.find(c => c.id === activeChatTargetId) || activeParentServer.channels[0] || null;
    }
  }

  if (!activeServerChannel && activeChatTargetId) {
    for (const s of chatServers) {
      const ch = s.channels?.find(c => c.id === activeChatTargetId);
      if (ch) {
        activeServerChannel = ch;
        activeParentServer = s;
        break;
      }
    }
  }

  // Active Room Resolution
  let activeRoomInfo: ChatRoom;
  if (activeServerChannel && activeParentServer) {
    let cleanChannelName = activeServerChannel.name;
    if (!cleanChannelName.startsWith('#') && !cleanChannelName.startsWith('📢') && !cleanChannelName.startsWith('💡') && !cleanChannelName.startsWith('💬')) {
      cleanChannelName = `#${cleanChannelName}`;
    }

    activeRoomInfo = {
      id: activeServerChannel.id,
      name: cleanChannelName,
      type: activeServerChannel.type === 'announcement' ? 'channel' : 'group',
      icon: activeServerChannel.type === 'announcement' ? '📢' : activeServerChannel.type === 'class' ? '💡' : '#',
      description: activeServerChannel.topic || `${activeParentServer.name} • ${activeServerChannel.category || 'General'} Channel`,
      code: activeParentServer.inviteCode || activeParentServer.id.split('_').pop()?.toUpperCase() || '',
      serverId: activeParentServer.id,
      creatorId: activeParentServer.ownerId,
      members: activeParentServer.members || [],
      moderators: [activeParentServer.ownerId]
    };
  } else {
    activeRoomInfo = chatRooms.find(r => r.id === activeChatTargetId) || {
      id: 'group-all',
      name: 'General Lounge',
      type: 'group' as const,
      icon: '🌍',
      description: 'School-wide lounge for students and teachers',
      code: 'GLOBAL'
    };
  }

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

  // Categorize Chat Rooms into Direct Messages and Group Rooms (strictly excluding server channels)
  const dmRooms = chatRooms.filter(r => r.type === 'friend' || r.id.startsWith('dm_'));
  const groupRooms = chatRooms.filter(r => 
    r.type !== 'friend' && 
    !r.id.startsWith('dm_') && 
    !r.serverId && 
    !r.id.startsWith('ch_') && 
    !r.id.startsWith('server_') &&
    r.type !== 'channel'
  );

  // Available Users list for starting new DMs
  const availableUsersList = allProfiles.length > 0 ? allProfiles : students;

  return (
    <>
      <div className={activeTab === 'peer_chat' || !activeTab ? 'h-full flex flex-col' : 'hidden'}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-[calc(100vh-8.5rem)] md:h-[calc(100vh-9.5rem)] min-h-[500px] max-w-7xl mx-auto shadow-2xl animate-fadeIn font-sans">
      
      {/* Left Column: Discord-style Server Rail + Channel/DM Sidebar */}
      <div className={`md:col-span-5 lg:col-span-4 bg-slate-900/90 border border-white/10 rounded-3xl overflow-hidden flex min-h-0 ${showChatSidebarMobile ? 'flex h-full' : 'hidden md:flex'}`}>
        
        {/* Tier 1: Discord Server Rail */}
        <div className="w-14 sm:w-16 shrink-0 bg-slate-950 flex flex-col items-center py-3 gap-2.5 border-r border-white/10 select-none">
          {/* Home / Direct Messages Icon */}
          <div className="relative group">
            {activeServerId === 'home' && (
              <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-white rounded-r-full" />
            )}
            <button
              onClick={() => {
                setActiveServerId('home');
                if (dmRooms.length > 0) setActiveChatTargetId(dmRooms[0].id);
              }}
              className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center transition-all ${
                activeServerId === 'home' 
                  ? 'bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/30' 
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 rounded-3xl hover:rounded-2xl border border-white/5'
              }`}
              title="Direct Messages & Groups"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>

          <div className="w-7 h-[2px] bg-white/10 rounded-full my-0.5" />

          {/* Server Icons List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 w-full flex flex-col items-center pr-0.5 scrollbar-none">
            {chatServers.map(server => {
              const isActive = activeServerId === server.id;
              return (
                <div key={server.id} className="relative group">
                  {isActive && (
                    <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-white rounded-r-full" />
                  )}
                  <button
                    onClick={() => {
                      setActiveServerId(server.id);
                      if (server.channels && server.channels.length > 0) {
                        setActiveChatTargetId(server.channels[0].id);
                      }
                    }}
                    className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-lg transition-all ${
                      isActive 
                        ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg ring-2 ring-white/20 rounded-2xl' 
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:rounded-2xl rounded-3xl border border-white/5'
                    }`}
                    title={server.name}
                  >
                    <span>{server.icon || '💬'}</span>
                  </button>
                </div>
              );
            })}

            {/* Create Server (+) */}
            <button
              onClick={() => setShowCreateServerModal(true)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-3xl hover:rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-dashed border-emerald-500/40 flex flex-col items-center justify-center transition-all hover:scale-105"
              title="Create New Server"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[8px] font-bold tracking-tighter uppercase -mt-0.5">New</span>
            </button>

            {/* Join Server (🔑 Code) */}
            <button
              onClick={() => {
                setJoinServerCodeInput('');
                setJoinServerError('');
                setShowJoinServerModal(true);
              }}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-3xl hover:rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-dashed border-indigo-500/40 flex flex-col items-center justify-center transition-all hover:scale-105"
              title="Join Server via Invite Code"
            >
              <Globe className="w-4 h-4" />
              <span className="text-[8px] font-bold tracking-tighter uppercase -mt-0.5">Join</span>
            </button>
          </div>

          {/* User Presence & Status Picker Orb at Bottom */}
          <div className="relative pt-2 border-t border-white/10 w-full flex justify-center">
            <button
              onClick={() => setShowPresencePicker(!showPresencePicker)}
              className="relative group p-0.5"
              title={`Presence: ${myPresenceStatus.toUpperCase()} (Click to toggle)`}
            >
              {currentUser?.avatar || currentUser?.photoURL ? (
                <img src={currentUser.avatar || currentUser.photoURL} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-white/20" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white/20">
                  {(currentUser?.name || 'U').charAt(0)}
                </div>
              )}
              <span className={`w-3 h-3 rounded-full border-2 border-slate-950 absolute bottom-0 right-0 ${
                myPresenceStatus === 'online' ? 'bg-emerald-400 ring-2 ring-emerald-500/30' :
                myPresenceStatus === 'idle' ? 'bg-amber-400' :
                myPresenceStatus === 'dnd' ? 'bg-rose-500' : 'bg-slate-500'
              }`} />
            </button>

            {showPresencePicker && (
              <div className="absolute left-14 bottom-1 bg-slate-900 border border-white/15 rounded-2xl p-2 w-48 shadow-2xl z-50 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">Set Online Presence</p>
                {[
                  { id: 'online', label: 'Online', color: 'bg-emerald-400' },
                  { id: 'idle', label: 'Idle / Away', color: 'bg-amber-400' },
                  { id: 'dnd', label: 'Do Not Disturb', color: 'bg-rose-500' },
                  { id: 'offline', label: 'Invisible', color: 'bg-slate-500' }
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => handleUpdatePresence(st.id as any)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-white/10 text-left transition-colors ${myPresenceStatus === st.id ? 'text-white bg-indigo-600/30 font-bold' : 'text-slate-300'}`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${st.color}`} />
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tier 2: Channels or DM list */}
        <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-3.5 space-y-3">
          
          {/* HOME MODE: Direct Messages & Groups */}
          {activeServerId === 'home' ? (
            <>
              {/* Header & New Actions */}
              <div className="flex flex-col gap-3 shrink-0">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-black text-xs uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Home Hub
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowNewDmModal(true)}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all border border-white/5 active:scale-95"
                      title="New Direct Message"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsCreatingRoom(true)}
                      className="w-8 h-8 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 flex items-center justify-center transition-all border border-indigo-500/20 active:scale-95"
                      title="New Group Chat"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Home Tab Selector (WhatsApp style) */}
                <div className="flex bg-slate-950/50 p-1 rounded-2xl border border-white/5">
                  {[
                    { id: 'all', label: 'All', icon: Globe },
                    { id: 'dms', label: 'DMs', icon: MessageSquare },
                    { id: 'groups', label: 'Groups', icon: Users }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setHomeSidebarTab(tab.id as any)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${homeSidebarTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <tab.icon className="w-3 h-3" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full bg-slate-950/80 border border-white/10 rounded-2xl pl-9 pr-3 py-2 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
              </div>

              {/* Unified Conversations List */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {/* DIRECT MESSAGES SECTION */}
                {(homeSidebarTab === 'all' || homeSidebarTab === 'dms') && (
                  <div className="space-y-1">
                    {homeSidebarTab === 'all' && dmRooms.length > 0 && (
                      <div className="flex items-center gap-2 px-2 py-1 opacity-50">
                        <span className="w-full h-px bg-white/10" />
                        <span className="text-[9px] font-black uppercase text-slate-500 whitespace-nowrap">Direct Messages</span>
                        <span className="w-full h-px bg-white/10" />
                      </div>
                    )}
                    
                    {dmRooms.length === 0 && homeSidebarTab === 'dms' && (
                      <div className="p-8 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-indigo-600/10 border border-dashed border-indigo-500/20 flex items-center justify-center mx-auto">
                          <MessageSquare className="w-6 h-6 text-indigo-400/40" />
                        </div>
                        <p className="text-[10px] text-slate-500 italic">No direct messages yet.</p>
                        <button onClick={() => setShowNewDmModal(true)} className="text-[10px] text-indigo-400 font-bold hover:underline">Start a Chat</button>
                      </div>
                    )}

                    {dmRooms
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
                        const lastMsg = chats.filter(c => c.targetId === room.id).pop();

                        return (
                          <button
                            key={room.id}
                            onClick={() => {
                              setActiveChatTargetId(room.id);
                              setShowChatSidebarMobile(false);
                            }}
                            className={`w-full group text-left p-2 rounded-2xl transition-all flex items-center gap-3 relative ${isActive ? 'bg-indigo-600/15 ring-1 ring-indigo-500/30 shadow-xl' : 'hover:bg-white/5'}`}
                          >
                            <div className="relative shrink-0">
                              {otherUser?.avatar || otherUser?.photoURL ? (
                                <img src={otherUser.avatar || otherUser.photoURL} alt="" className="w-11 h-11 rounded-2xl object-cover border border-white/10 ring-1 ring-white/5 shadow-lg" />
                              ) : (
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-purple-600/30 text-indigo-300 font-black text-sm flex items-center justify-center border border-indigo-500/30">
                                  {displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className={`w-3 h-3 rounded-full ${getStatusColor(otherUser?.uid || '')} border-2 border-slate-900 absolute -bottom-0.5 -right-0.5 shadow-lg`} />
                            </div>

                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex justify-between items-center">
                                <span className={`text-[13px] font-black truncate transition-colors ${isActive ? 'text-white' : 'text-slate-200'}`}>{displayName}</span>
                                {lastMsg && (
                                  <span className="text-[9px] text-slate-500 font-medium bg-slate-950/50 px-1.5 py-0.5 rounded-lg border border-white/5">
                                    {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-0.5 gap-2">
                                <p className={`text-[11px] truncate flex-1 ${isActive ? 'text-indigo-200/70' : 'text-slate-500'}`}>
                                  {lastMsg ? (
                                    <span className="flex items-center gap-1">
                                      {lastMsg.ownerUid === currentUser?.uid && <CheckCheck className="w-3 h-3 text-sky-500 shrink-0" />}
                                      {lastMsg.message}
                                    </span>
                                  ) : (otherUser ? `${otherUser.role.toUpperCase()} • ${otherUser.grade || 'Campus'}` : 'Say hello!')}
                                </p>
                              </div>
                            </div>
                            
                            {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-l-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
                          </button>
                        );
                      })}
                  </div>
                )}

                {/* GROUP ROOMS SECTION */}
                {(homeSidebarTab === 'all' || homeSidebarTab === 'groups') && (
                  <div className="space-y-1 mt-4">
                    {homeSidebarTab === 'all' && groupRooms.length > 0 && (
                      <div className="flex items-center gap-2 px-2 py-1 opacity-50">
                        <span className="w-full h-px bg-white/10" />
                        <span className="text-[9px] font-black uppercase text-slate-500 whitespace-nowrap">Channels & Groups</span>
                        <span className="w-full h-px bg-white/10" />
                      </div>
                    )}

                    {groupRooms.length === 0 && homeSidebarTab === 'groups' && (
                      <div className="p-8 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-purple-600/10 border border-dashed border-purple-500/20 flex items-center justify-center mx-auto">
                          <Users className="w-6 h-6 text-purple-400/40" />
                        </div>
                        <p className="text-[10px] text-slate-500 italic">No group chats found.</p>
                        <button onClick={() => setIsCreatingRoom(true)} className="text-[10px] text-purple-400 font-bold hover:underline">Create a Group</button>
                      </div>
                    )}

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
                            className={`w-full group text-left p-2.5 rounded-2xl transition-all flex items-center gap-3 relative ${isActive ? 'bg-purple-600/15 ring-1 ring-purple-500/30 shadow-xl' : 'hover:bg-white/5'}`}
                          >
                            <div className="w-11 h-11 shrink-0 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center text-xl shadow-lg ring-1 ring-white/5 group-hover:scale-105 transition-transform">
                              {room.icon}
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex justify-between items-center">
                                <span className={`text-[13px] font-black truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>{room.name}</span>
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${badgeStyle}`}>
                                  {room.type}
                                </span>
                              </div>
                              <p className={`text-[11px] truncate mt-0.5 ${isActive ? 'text-purple-200/70' : 'text-slate-500'}`}>
                                {lastMsg ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-400">{lastMsg.name.split(' ')[0]}:</span>
                                    <span>{lastMsg.message}</span>
                                  </span>
                                ) : room.description}
                              </p>
                            </div>
                            {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500 rounded-l-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* SERVER MODE: Categorized Server Channels */
            (() => {
              const currentServer = chatServers.find(s => s.id === activeServerId);
              if (!currentServer) return null;
              const channels = currentServer.channels || [];
              
              // Dynamically collect unique categories from channels
              const uniqueCategories = Array.from(new Set(channels.map(c => c.category || 'General')));
              // Ensure 'General' is always present and first if it exists
              const sortedCategories = uniqueCategories.sort((a, b) => {
                if (a === 'General') return -1;
                if (b === 'General') return 1;
                return a.localeCompare(b);
              });

              return (
                <>
                  {/* Server Banner & Header */}
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 p-3 bg-gradient-to-r from-indigo-950/80 to-slate-900 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-2xl shrink-0">{currentServer.icon}</span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-white truncate">{currentServer.name}</h4>
                          <p className="text-[9px] text-indigo-300 truncate">{channels.length} channels</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setServerInviteSearchQuery('');
                            setShowServerInviteModal(true);
                          }}
                          className="px-2 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                          title="Invite & Add Members to Server"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Invite</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowServerMembersModal(true);
                          }}
                          className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-white/10 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                          title="Server Members"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Members</span>
                        </button>
                        {(currentServer.ownerId === currentUser?.uid || currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                          <button
                            onClick={() => {
                              setRolesTargetId(currentServer.id);
                              setShowManageRolesModal(true);
                            }}
                            className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white border border-white/10 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                            title="Manage Roles"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            <span className="hidden sm:inline">Roles</span>
                          </button>
                        )}
                        <button
                          onClick={() => setShowCreateChannelModal(true)}
                          className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md text-xs font-bold flex items-center justify-center"
                          title="Create Channel"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Channel Search */}
                  <div className="relative shrink-0">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      placeholder="Search channels..."
                      className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Categorized Channels Stream */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin">
                    {sortedCategories.map(cat => {
                      const catChannels = channels.filter(c => (c.category || 'General') === cat);
                      if (catChannels.length === 0 && cat !== 'General') return null;

                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between px-1 py-0.5">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                              {cat}
                            </span>
                            <span className="text-[9px] text-slate-600 font-mono">{catChannels.length}</span>
                          </div>

                          {catChannels
                            .filter(ch => !chatSearchQuery || ch.name.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                            .map(ch => {
                              const isActive = activeChatTargetId === ch.id;
                              return (
                                <button
                                  key={ch.id}
                                  onClick={() => {
                                    setActiveChatTargetId(ch.id);
                                    setShowChatSidebarMobile(false);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-xl border transition-all flex items-center justify-between group ${
                                    isActive 
                                      ? 'bg-indigo-600/25 border-indigo-500/50 text-white shadow-md' 
                                      : 'bg-transparent border-transparent hover:bg-slate-950/60 hover:border-white/5 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="text-xs text-indigo-400 font-bold shrink-0">
                                      {ch.type === 'announcement' ? '📢' : ch.type === 'class' ? '💡' : '#'}
                                    </span>
                                    <span className="text-xs font-semibold truncate group-hover:text-white">
                                      {ch.name.replace(/^📢-|^💡-|^💬-/, '')}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {ch.topic && (
                                      <span className="text-[8px] text-slate-500 truncate max-w-[80px] hidden group-hover:inline">
                                        {ch.topic}
                                      </span>
                                    )}
                                    {(currentServer.ownerId === currentUser?.uid || currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteChannel(currentServer.id, ch.id);
                                        }}
                                        className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete Channel"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      );
                    })}

                    {/* Roles Overview in Server */}
                    {currentServer.roles && currentServer.roles.length > 0 && (
                      <div className="pt-2 border-t border-white/5 space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 px-1">
                          Community Roles
                        </span>
                        <div className="flex flex-wrap gap-1 px-1">
                          {currentServer.roles.map(r => (
                            <span
                              key={r.id}
                              style={{ borderColor: `${r.color}40`, color: r.color, backgroundColor: `${r.color}15` }}
                              className="px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                              <span>{r.name}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>

      {/* Right Column: Chat Dialog Box */}
      <div className={`md:col-span-8 bg-slate-900/90 border border-white/10 rounded-3xl p-3 sm:p-5 flex flex-col min-h-0 justify-between ${!showChatSidebarMobile ? 'flex h-full' : 'hidden md:flex'}`}>
        
        {/* Active Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 sm:pb-3.5 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setShowChatSidebarMobile(true)}
              className="md:hidden p-1.5 bg-white/5 rounded-lg border border-white/10 text-white text-[11px] flex items-center gap-1 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden min-[320px]:inline">Chats</span>
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
              className="flex items-center gap-2 sm:gap-2.5 text-left hover:opacity-80 transition-opacity min-w-0 flex-1"
            >
              {typeof activeDisplayIcon === 'string' && activeDisplayIcon.length > 2 ? (
                <img src={activeDisplayIcon} alt="" className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl object-cover border border-white/10 shrink-0" />
              ) : (
                <span className="text-lg sm:text-2xl p-1 sm:p-1.5 bg-slate-950 border border-white/10 rounded-xl sm:rounded-2xl shrink-0">{activeDisplayIcon}</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h4 className="font-black text-xs sm:text-sm text-white truncate">{activeDisplayTitle}</h4>
                  {isDirectMessage && (
                    <span className="hidden sm:inline-block text-[9px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                      Direct Message
                    </span>
                  )}
                  {activeRoomInfo.type === 'channel' && (
                    <span className="hidden sm:inline-block text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                      📢 Broadcast Channel
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{activeDisplayDesc}</p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Call Buttons for Direct Messages */}
            {isDirectMessage && dmOtherUser && (
              <div className="flex items-center gap-1.5 bg-slate-950/50 p-1 rounded-2xl border border-white/5 mr-1">
                <button
                  onClick={() => handleStartCall(dmOtherUser!, 'audio')}
                  title="Voice Call"
                  className="p-2 hover:bg-emerald-600/20 text-emerald-400 rounded-xl transition-all active:scale-90"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleStartCall(dmOtherUser!, 'video')}
                  title="Video Call"
                  className="p-2 hover:bg-indigo-600/20 text-indigo-400 rounded-xl transition-all active:scale-90"
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Member List Toggle (For Groups/Servers) */}
            {!isDirectMessage && (
              <button
                onClick={() => setShowMemberList(!showMemberList)}
                className={`p-2 rounded-xl border transition-all active:scale-90 flex items-center gap-1.5 ${showMemberList ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'}`}
                title="Toggle Member List"
              >
                <Users className="w-4 h-4" />
                <span className="hidden xl:inline text-[10px] font-bold uppercase tracking-wider">Members</span>
              </button>
            )}

            {/* Group QR / Server Invite Trigger */}
            {!isDirectMessage && (
              <button
                onClick={() => {
                  if (activeServerId !== 'home') {
                    setShowServerSettingsModal(true);
                  } else {
                    setShowQrModal(true);
                  }
                }}
                title="Invite Member"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-white/10 transition-all active:scale-90"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}

            {/* Settings button (Room Settings or Server Settings for Owner/Admin) */}
            {!isDirectMessage && (
              activeServerId !== 'home' ? (
                (() => {
                  const currentServer = chatServers.find(s => s.id === activeServerId);
                  const isOwnerOrAdmin = currentServer && (currentServer.ownerId === currentUser?.uid || currentUser?.role === 'admin' || currentUser?.role === 'super_admin');
                  if (!isOwnerOrAdmin) return null;
                  return (
                    <button
                      onClick={() => setShowServerSettingsModal(true)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-white/10 transition-all active:scale-90 flex items-center gap-1 text-[10px] font-bold uppercase"
                      title="Server Settings"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="hidden sm:inline">Settings</span>
                    </button>
                  );
                })()
              ) : (
                <button
                  onClick={() => {
                    setEditRoomName(activeRoomInfo.name);
                    setEditRoomDescription(activeRoomInfo.description || '');
                    setEditRoomIcon(activeRoomInfo.icon || '💬');
                    setShowGroupSettings(true);
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-white/10 transition-all active:scale-90 flex items-center gap-1 text-[10px] font-bold uppercase"
                  title="Room Settings"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              )
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

        {/* Chat Main Area Container (Messages + Member List) */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
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
                    className={`flex items-start gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Sender Avatar - Click to open Profile Card */}
                    <button
                      onClick={() => setSelectedProfileUser(senderUser)}
                      title={`View profile of ${displayName}`}
                      className="shrink-0 hover:scale-110 transition-transform active:scale-95"
                    >
                      {senderUser?.avatar || senderUser?.photoURL ? (
                        <img src={senderUser.avatar || senderUser.photoURL} alt="" className="w-9 h-9 rounded-2xl object-cover border border-white/10 ring-1 ring-white/5 shadow-lg" />
                      ) : (
                        <div className="w-9 h-9 rounded-2xl bg-indigo-600/30 text-indigo-300 font-extrabold text-xs flex items-center justify-center border border-indigo-500/30 shadow-md">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>

                    <div className={`max-w-[85%] sm:max-w-[75%] min-w-0 space-y-1 ${isMine ? 'items-end' : 'items-start'}`}>
                      
                      {/* Header info */}
                      <div className={`flex items-center gap-1.5 text-[10px] ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <button
                          onClick={() => setCommunityProfileUser(senderUser)}
                          className="font-black text-slate-200 hover:text-indigo-400 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{displayName}</span>
                          {senderUser && getVerificationStatus(senderUser).isVerified && (
                            <ShieldCheck className="w-3 h-3 text-indigo-400" />
                          )}
                        </button>
                        <span className="text-[8px] text-indigo-400 uppercase font-black bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20 tracking-tighter">
                          {senderUser?.role || msg.role}
                        </span>
                        <div className="flex items-center gap-1 ml-1">
                          <span className="text-[9px] text-slate-500">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && (
                            <button onClick={() => handleOpenReceiptsModal(msg)} className="hover:scale-110 transition-transform">
                              {msg.readBy && msg.readBy.length > 1 ? (
                                <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                              ) : msg.deliveredTo && msg.deliveredTo.length > 0 ? (
                                <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Reply Context preview */}
                      {msg.replyToText && (
                        <div className="bg-slate-950/60 border-l-2 border-indigo-500 p-2 rounded-r-xl text-[10px] text-slate-400 italic mb-0.5 shadow-sm max-w-xs truncate">
                          <span className="font-bold text-indigo-300">@{msg.replyToSender}: </span>
                          <span>{msg.replyToText}</span>
                        </div>
                      )}

                      {/* Main Bubble */}
                      <div
                        onContextMenu={(e) => { e.preventDefault(); setMobileSelectedMsg(msg); }}
                        className={`message-bubble p-3 rounded-2xl text-[13px] relative group transition-all duration-200 ${isMine ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/20' : 'bg-slate-950 border border-white/10 text-slate-200 rounded-tl-none shadow-md'}`}
                      >
                        {/* Message Actions (Desktop hover) */}
                        <div className={`absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900 border border-white/10 rounded-xl p-1 z-10 shadow-2xl ${isMine ? 'right-0' : 'left-0'}`}>
                          {['👍', '❤️', '🔥'].map(emoji => (
                            <button key={emoji} onClick={() => handleToggleReaction(msg.id, emoji)} className="p-1 hover:bg-white/10 rounded-lg text-xs hover:scale-125 transition-transform">{emoji}</button>
                          ))}
                          <div className="w-px h-3 bg-white/10 mx-0.5" />
                          <button onClick={() => setReplyingTo(msg)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white" title="Reply"><Reply className="w-3.5 h-3.5" /></button>
                          {isMine && <button onClick={() => { setEditingMsgId(msg.id); setEditText(msg.message); }} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>}
                          {(isMine || (activeServerId !== 'home' && (() => {
                            const cs = chatServers.find(s => s.id === activeServerId);
                            return cs && (cs.ownerId === currentUser?.uid || currentUser?.role === 'admin' || currentUser?.role === 'super_admin');
                          })())) && (
                            <button onClick={() => handleDeleteMessage(msg.id, true)} className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors" title="Delete Message"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                        
                        {msg.flaggedReason && (
                          <div className="text-[10px] bg-rose-500/20 border border-rose-500/30 text-rose-300 px-2 py-0.5 rounded-md mb-1 font-bold flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Flagged: {msg.flaggedReason}</span>
                          </div>
                        )}

                        {editingMsgId === msg.id ? (
                          <div className="space-y-2">
                            <textarea value={editText} onChange={e => setEditText(e.target.value)} className="w-full bg-slate-900 border border-white/20 rounded-xl p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" autoFocus />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingMsgId(null)} className="text-[11px] text-slate-400 font-bold px-2 py-1">Cancel</button>
                              <button onClick={() => handleSaveEdit(msg.id)} className="text-[11px] bg-indigo-500 text-white px-3 py-1 rounded-lg font-bold shadow-lg">Save</button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed selection:bg-indigo-300 selection:text-indigo-900">{msg.message}</p>
                        )}

                        {/* Attachments rendering */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {msg.attachments.map((att, i) => (
                              <div key={i} className="rounded-xl overflow-hidden border border-white/10 bg-black/30 p-2 group/att">
                                {att.type === 'image' && (
                                  <img src={att.url} alt={att.name} onClick={() => setActiveMediaPreview({ type: 'image', url: att.url, name: att.name || 'Image' })} className="max-h-64 rounded-lg object-cover w-full cursor-pointer hover:opacity-90 transition-opacity" />
                                )}
                                {att.type === 'video' && (
                                  <video controls src={att.url} className="max-h-64 rounded-lg object-cover w-full bg-black shadow-inner" />
                                )}
                                {att.type === 'audio' && (
                                  <audio controls src={att.url} className="w-full h-8 mt-1" />
                                )}
                                {(att.type === 'pdf' || att.type === 'file') && (
                                  <div className="flex items-center justify-between gap-3 p-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400"><Paperclip className="w-4 h-4" /></div>
                                      <span className="text-[11px] font-bold truncate text-slate-200">{att.name}</span>
                                    </div>
                                    <a href={att.url} download className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"><Download className="w-4 h-4" /></a>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reactions display unified inside bubble */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`flex flex-wrap gap-1.5 mt-2.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(msg.reactions).map(([emoji, uids]) => {
                              const hasReacted = uids.includes(currentUser?.uid || '');
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black transition-all ${hasReacted ? 'bg-indigo-500/20 border-indigo-500 text-white scale-110 shadow-md' : 'bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20'}`}
                                >
                                  <span>{emoji}</span>
                                  <span>{uids.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT SIDEBAR: Member List */}
          <AnimatePresence>
            {showMemberList && !isDirectMessage && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="hidden lg:flex flex-col border-l border-white/10 bg-slate-950/30 overflow-hidden"
              >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Room Members</h5>
                  <span className="bg-slate-900 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-400">{(activeRoomInfo.members || []).length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
                  {(activeRoomInfo.members || []).map(uid => {
                    const user = resolveUser(uid);
                    const isOwner = activeRoomInfo.creatorId === uid;
                    const isMod = (activeRoomInfo.moderators || []).includes(uid);
                    
                    return (
                      <button
                        key={uid}
                        onClick={() => setCommunityProfileUser(user)}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all group"
                      >
                        <div className="relative">
                          {user.avatar || user.photoURL ? (
                            <img src={user.avatar || user.photoURL} alt="" className="w-8 h-8 rounded-xl object-cover ring-1 ring-white/10" />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-[10px] font-black text-slate-400">
                              {user.name.charAt(0)}
                            </div>
                          )}
                          <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(uid)} border-2 border-slate-950 absolute -bottom-0.5 -right-0.5`} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-1">
                            <p className="text-[11px] font-black text-slate-200 truncate group-hover:text-indigo-400 transition-colors">{user.name}</p>
                            {isOwner && <span title="Server Owner"><ShieldCheck className="w-3 h-3 text-amber-500" /></span>}
                            {isMod && !isOwner && <span title="Moderator"><Shield className="w-3 h-3 text-indigo-400" /></span>}
                          </div>
                          <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter truncate">{user.role}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Upload Attachment */}
            <label className="p-2 sm:p-2.5 bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-white rounded-xl sm:rounded-2xl cursor-pointer transition-colors shrink-0">
              <Paperclip className="w-4 h-4" />
              <input type="file" multiple onChange={handleFileUpload} className="hidden" />
            </label>

            {/* Mic / Voice Note Record Button */}
            <button
              onClick={isRecordingAudio ? stopRecording : startRecording}
              className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all shrink-0 ${isRecordingAudio ? 'bg-rose-600 text-white border-rose-500 animate-pulse' : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white hover:bg-slate-800'}`}
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
              className="flex-1 min-w-0 bg-slate-950 border border-white/10 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />

            {/* Send Button */}
            <button
              onClick={handleSendChat}
              disabled={!canPostInChannel || (!newChatText.trim() && attachedFiles.length === 0)}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl font-bold transition-all shadow-lg active:scale-95 shrink-0"
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

            {/* Tab Selector */}
            <div className="flex bg-slate-950/50 p-1 rounded-2xl border border-white/5 shrink-0">
              {[
                { id: 'info', label: 'Info', icon: Info },
                { id: 'members', label: 'Members', icon: Users },
                { id: 'roles', label: 'Roles', icon: Shield }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${settingsTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* TAB: INFO */}
            {settingsTab === 'info' && (
              <div className="space-y-5 animate-fadeIn">
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
                      if (activeRoomInfo.serverId) {
                        const s = chatServers.find(srv => srv.id === activeRoomInfo.serverId);
                        if (s) {
                          const updatedS = { ...s, name: updated.name, description: updated.description, icon: updated.icon };
                          await saveChatServer(updatedS);
                        }
                      } else {
                        setChatRooms(prev => prev.map(r => r.id === updated.id ? updated : r));
                        await saveChatRoom(updated);
                      }
                      showNotification('Room details updated!');
                    }}
                    className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-white/5"
                  >
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Update Community Identity</h4>
                    <div className="flex gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Icon</label>
                        <input
                          type="text"
                          value={editRoomIcon}
                          onChange={e => setEditRoomIcon(e.target.value)}
                          className="w-14 bg-slate-900 border border-white/10 rounded-xl py-2.5 text-center text-xl text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Display Name</label>
                        <input
                          type="text"
                          value={editRoomName}
                          onChange={e => setEditRoomName(e.target.value)}
                          required
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Community Motto / Description</label>
                      <textarea
                        value={editRoomDescription}
                        onChange={e => setEditRoomDescription(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-300 h-24 focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">Save Changes</button>
                  </form>
                )}

                {/* Invite Code Section */}
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Share Invite Code</span>
                    {isModerator && !activeRoomInfo.serverId && (
                      <button
                        onClick={async () => {
                          const newCode = await regenerateRoomCode(activeRoomInfo);
                          setChatRooms(prev => prev.map(r => r.id === activeRoomInfo.id ? { ...r, code: newCode } : r));
                          showNotification(`Code refreshed: ${newCode}`);
                        }}
                        className="text-[9px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-tighter"
                      >
                        Refresh Code
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 border border-white/10 p-3 rounded-xl">
                    <span className="font-mono text-emerald-400 font-black text-lg tracking-widest">{activeRoomInfo.code || 'GLOBAL'}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeRoomInfo.code || 'GLOBAL');
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                        showNotification('Code copied to clipboard!');
                      }}
                      className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border border-emerald-500/20"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedLink ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: MEMBERS */}
            {settingsTab === 'members' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Community Members ({(activeRoomInfo.members || []).length})</h4>
                  <button onClick={() => setShowQrModal(true)} className="text-[9px] text-indigo-400 font-black uppercase flex items-center gap-1"><UserPlus className="w-3 h-3" /> Invite</button>
                </div>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                  {(activeRoomInfo.members || []).map(memberUid => {
                    const memberUser = resolveUser(memberUid);
                    const isOwner = activeRoomInfo.creatorId === memberUid;
                    const isMod = activeRoomInfo.moderators?.includes(memberUid) || isOwner;
                    const isSelf = memberUid === currentUser?.uid;

                    return (
                      <div key={memberUid} className="flex justify-between items-center p-3 bg-slate-950/40 rounded-2xl border border-white/5 group hover:bg-slate-950/60 transition-all">
                        <button onClick={() => setCommunityProfileUser(memberUser)} className="flex items-center gap-3 min-w-0">
                          <div className="relative">
                            {memberUser.avatar || memberUser.photoURL ? (
                              <img src={memberUser.avatar || memberUser.photoURL} alt="" className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/10" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center font-black text-xs text-slate-400">
                                {memberUser.name.charAt(0)}
                              </div>
                            )}
                            <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(memberUid)} border-2 border-slate-950 absolute -bottom-0.5 -right-0.5`} />
                          </div>
                          <div className="text-left min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-black text-slate-200 truncate">{memberUser.name}{isSelf && ' (You)'}</p>
                              {isOwner && <span title="Owner"><ShieldCheck className="w-3.5 h-3.5 text-amber-500" /></span>}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{memberUser.role}</span>
                              {isMod && !isOwner && <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1 py-0.2 rounded border border-indigo-500/30 font-black uppercase">Moderator</span>}
                            </div>
                          </div>
                        </button>

                        {isModerator && !isOwner && !isSelf && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isMod && (
                              <button onClick={() => {
                                const updated = { ...activeRoomInfo, moderators: [...(activeRoomInfo.moderators || []), memberUid] };
                                setChatRooms(prev => prev.map(r => r.id === updated.id ? updated : r));
                                saveChatRoom(updated);
                                showNotification(`Promoted ${memberUser.name}`);
                              }} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/40" title="Promote to Mod"><Shield className="w-4 h-4" /></button>
                            )}
                            <button onClick={() => {
                              const updated = { ...activeRoomInfo, members: (activeRoomInfo.members || []).filter(m => m !== memberUid), moderators: (activeRoomInfo.moderators || []).filter(m => m !== memberUid) };
                              setChatRooms(prev => prev.map(r => r.id === updated.id ? updated : r));
                              saveChatRoom(updated);
                              showNotification(`Removed ${memberUser.name}`);
                            }} className="p-2 bg-rose-600/20 text-rose-400 rounded-lg hover:bg-rose-600/40" title="Kick Member"><LogOut className="w-4 h-4" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB: ROLES */}
            {settingsTab === 'roles' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Custom Roles & Permissions</h4>
                  {isModerator && (
                    <button
                      onClick={() => {
                        setRolesTargetId(activeRoomInfo.id);
                        setShowManageRolesModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all"
                    >
                      + Create Role
                    </button>
                  )}
                </div>
                
                <div className="bg-slate-950/40 p-5 rounded-3xl border border-white/5 flex flex-col items-center text-center space-y-3 py-12">
                  <Shield className="w-12 h-12 text-slate-700 animate-pulse" />
                  <div>
                    <p className="text-sm font-black text-slate-400">Custom Communities Roles</p>
                    <p className="text-[10px] text-slate-600 mt-1 max-w-[240px]">Create distinct roles with specialized permissions to organize your community better.</p>
                  </div>
                  <button
                    onClick={() => {
                      setRolesTargetId(activeRoomInfo.id);
                      setShowManageRolesModal(true);
                    }}
                    className="text-[11px] text-indigo-400 font-bold hover:underline"
                  >
                    Configure Advanced Permissions
                  </button>
                </div>
              </div>
            )}

            {/* Danger Zone Actions */}
            <div className="border-t border-white/10 pt-5 space-y-3">
              {activeRoomInfo.id !== 'group-all' && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={async () => {
                      if (!currentUser) return;
                      await leaveChatRoom(activeRoomInfo.id, currentUser.uid);
                      setChatRooms(prev => prev.filter(r => r.id !== activeRoomInfo.id));
                      setActiveChatTargetId('group-all');
                      setShowGroupSettings(false);
                      showNotification(`Left ${activeRoomInfo.name}`);
                    }}
                    className="flex-1 bg-slate-950 hover:bg-slate-800 text-slate-400 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-white/5 transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Leave Room</span>
                  </button>
                  {isModerator && (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Are you sure you want to PERMANENTLY delete ${activeRoomInfo.name}? This action is irreversible.`)) return;
                        await deleteChatRoom(activeRoomInfo.id);
                        setChatRooms(prev => prev.filter(r => r.id !== activeRoomInfo.id));
                        setActiveChatTargetId('group-all');
                        setShowGroupSettings(false);
                        showNotification(`Deleted ${activeRoomInfo.name}`);
                      }}
                      className="flex-1 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-rose-500/20 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Hub</span>
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
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-4 z-[9998] animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative space-y-5 text-center">
            
            {/* User Avatar & Call Status */}
            <div className="space-y-2.5">
              <div className="relative inline-block">
                {activeCall.targetUser.avatar || activeCall.targetUser.photoURL ? (
                  <img
                    src={activeCall.targetUser.avatar || activeCall.targetUser.photoURL}
                    alt=""
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover mx-auto ring-4 ring-indigo-500/40 shadow-2xl"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-2xl sm:text-3xl flex items-center justify-center mx-auto shadow-2xl border-2 border-white/20">
                    {activeCall.targetUser.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {(activeCall.mode === 'incoming' || activeCall.mode === 'outgoing') && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full animate-ping" />
                )}
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-black text-white truncate px-2">{activeCall.targetUser.name}</h3>
                <p className="text-xs text-indigo-400 font-mono font-bold flex items-center justify-center gap-1 mt-1">
                  {activeCall.type === 'video' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                  {activeCall.type === 'video' ? 'Direct Video Call' : 'Direct Voice Call'}
                </p>
                
                {/* Mode status text / duration */}
                <p className="text-xs text-slate-400 font-mono mt-1.5">
                  {activeCall.mode === 'incoming' && 'Incoming Call — Ringing...'}
                  {activeCall.mode === 'outgoing' && 'Ringing... Waiting for answer'}
                  {activeCall.mode === 'connecting' && 'Connecting secure peer stream...'}
                  {activeCall.mode === 'connected' && (
                    <span className="text-emerald-400 font-black">
                      Connected • {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Video preview area when video call is active */}
            {activeCall.type === 'video' && (activeCall.mode === 'connected' || activeCall.mode === 'connecting' || activeCall.mode === 'outgoing') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 aspect-video bg-slate-950 rounded-2xl overflow-hidden relative border border-white/10 p-2">
                {/* Remote Video Stream */}
                <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[120px]">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover ${remoteStream ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {!remoteStream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-[11px] gap-1">
                      <Video className="w-6 h-6 animate-pulse text-indigo-400/50" />
                      <span>{activeCall.mode === 'outgoing' ? 'Waiting for answer...' : 'Syncing video...'}</span>
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-mono text-white font-bold truncate max-w-[85%]">
                    {activeCall.targetUser.name}
                  </span>
                </div>

                {/* Local Video Stream */}
                <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[120px]">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${activeCall.isVideoOff ? 'opacity-0' : 'opacity-100'}`}
                  />
                  {activeCall.isVideoOff && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-[11px] gap-1">
                      <VideoOff className="w-6 h-6 text-rose-400/60" />
                      <span>Camera Off</span>
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-mono text-white font-bold">
                    You {activeCall.isMuted ? '(Muted)' : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Hidden Audio element for remote audio stream playback */}
            <audio ref={remoteAudioRef} autoPlay playsInline />

            {/* Controls based on Call Mode */}
            <div className="pt-1">
              {activeCall.mode === 'incoming' ? (
                <div className="flex items-center justify-center gap-6">
                  {/* Reject Call */}
                  <button
                    onClick={() => {
                      const payload = { callId: activeCall.callId, reason: 'declined' };
                      sendRealtimeEvent(`room_channel_${activeChatTargetId}`, 'call_rejected', payload);
                      if (activeCall.targetUser?.uid) {
                        sendRealtimeEvent(`user_calls_${activeCall.targetUser.uid}`, 'call_rejected', payload);
                      }
                      cleanupCall();
                      showNotification('Call declined.');
                    }}
                    className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-all hover:scale-105"
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
                          video: activeCall.type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
                        });
                        localMediaStreamRef.current = stream;
                      } catch (e) {
                        console.warn('Media access warning during call accept', e);
                      }

                      const payload = { callId: activeCall.callId, responderUid: currentUser?.uid };
                      sendRealtimeEvent(`room_channel_${activeChatTargetId}`, 'call_accepted', payload);
                      if (activeCall.targetUser?.uid) {
                        sendRealtimeEvent(`user_calls_${activeCall.targetUser.uid}`, 'call_accepted', payload);
                      }

                      setActiveCall(prev => prev ? {
                        ...prev,
                        mode: 'connected',
                        startTime: Date.now(),
                        isCaller: false,
                        connectionStatus: 'Connected'
                      } : null);
                      showNotification('Call connected!');
                    }}
                    className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition-all hover:scale-105"
                    title="Accept Call"
                  >
                    <Phone className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {/* Mic Toggle */}
                  <button
                    onClick={() => {
                      const next = !activeCall.isMuted;
                      if (localMediaStreamRef.current) {
                        localMediaStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
                      }
                      setActiveCall(prev => prev ? { ...prev, isMuted: next } : null);
                    }}
                    className={`p-3.5 rounded-2xl transition-all ${activeCall.isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                    title={activeCall.isMuted ? 'Unmute Mic' : 'Mute Mic'}
                  >
                    {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* Video Toggle */}
                  {activeCall.type === 'video' && (
                    <button
                      onClick={() => {
                        const next = !activeCall.isVideoOff;
                        if (localMediaStreamRef.current) {
                          localMediaStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !next; });
                        }
                        setActiveCall(prev => prev ? { ...prev, isVideoOff: next } : null);
                      }}
                      className={`p-3.5 rounded-2xl transition-all ${activeCall.isVideoOff ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`}
                      title={activeCall.isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                      {activeCall.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </button>
                  )}

                  {/* End / Cancel Call */}
                  <button
                    onClick={handleEndCall}
                    className="px-5 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-600/30 flex items-center gap-2 text-xs uppercase transition-all"
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

      {/* MEDIA PREVIEW MODAL */}
      {activeMediaPreview && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[10000] flex flex-col items-center justify-center p-4 animate-fadeIn">
          <div className="max-w-4xl w-full max-h-[90vh] flex flex-col items-center relative space-y-4">
            <div className="w-full flex items-center justify-between bg-slate-900/80 px-4 py-3 rounded-2xl border border-white/10">
              <span className="text-xs font-bold text-white truncate">{activeMediaPreview.name}</span>
              <div className="flex items-center gap-2">
                <a
                  href={activeMediaPreview.url}
                  data-url={activeMediaPreview.url}
                  target="_blank"
                  rel="noreferrer"
                  download={activeMediaPreview.name}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setActiveMediaPreview(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-hidden w-full">
              {activeMediaPreview.type === 'image' ? (
                <img src={activeMediaPreview.url} alt="" className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10" />
              ) : (
                <video controls src={activeMediaPreview.url} className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl border border-white/10 bg-black" />
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

      {/* MODAL 1: CREATE COMMUNITY SERVER */}
      {showCreateServerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowCreateServerModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-3xl p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl">🏛️</span>
              <div>
                <h3 className="text-base font-black text-white">Create Community Server</h3>
                <p className="text-xs text-slate-400">Launch a dedicated guild for your class, club, or society.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Server Name</label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={e => setNewServerName(e.target.value)}
                  placeholder="e.g. Robotics Guild, Grade 10 A"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Server Icon Emoji</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newServerIcon}
                    onChange={e => setNewServerIcon(e.target.value)}
                    className="w-16 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-lg text-center text-white"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['🏛️', '⚡', '🛡️', '🚀', '🎨', '🔬', '🏆', '💻'].map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setNewServerIcon(em)}
                        className="text-lg p-1.5 bg-slate-950 hover:bg-slate-800 rounded-xl border border-white/5"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Description</label>
                <textarea
                  value={newServerDesc}
                  onChange={e => setNewServerDesc(e.target.value)}
                  placeholder="What is this community space about?"
                  rows={2}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-white/10">
                <button
                  onClick={() => setShowCreateServerModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateServer}
                  disabled={!newServerName.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  Create Guild
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE SERVER CHANNEL */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowCreateChannelModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl text-indigo-400">#</span>
              <div>
                <h3 className="text-base font-black text-white">Create Channel</h3>
                <p className="text-xs text-slate-400">Add a categorized discussion channel to this server.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Channel Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  placeholder="e.g. homework-help, general-lounge"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Category</label>
                <select
                  value={newServerChannelCategory}
                  onChange={e => setNewServerChannelCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="General">💬 General Lounge</option>
                  <option value="Announcements">📢 Official Announcements</option>
                  <option value="Class & Doubts">💡 Class & Doubts Clearing</option>
                  <option value="Study Lounge">🎧 Silent Study Lounge</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Channel Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'text', label: 'Text', icon: '💬' },
                    { id: 'announcement', label: 'Notice', icon: '📢' },
                    { id: 'class', label: 'Academic', icon: '💡' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewChannelType(t.id as any)}
                      className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 ${newChannelType === t.id ? 'bg-indigo-600/30 border-indigo-500 text-white' : 'bg-slate-950 border-white/5 text-slate-400'}`}
                    >
                      <span className="text-base">{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-white/10">
                <button
                  onClick={() => setShowCreateChannelModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateChannel}
                  disabled={!newChannelName.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  Create Channel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MANAGE CUSTOM ROLES & PERMISSIONS */}
      {showManageRolesModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowManageRolesModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl text-indigo-400">🛡️</span>
              <div>
                <h3 className="text-base font-black text-white">Community Roles & Permissions</h3>
                <p className="text-xs text-slate-400">Configure hierarchy, role colors, and moderation rights.</p>
              </div>
            </div>

            {/* Existing Roles list */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Existing Roles</span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {(chatServers.find(s => s.id === rolesTargetId)?.roles || []).map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-xs font-bold text-white">{r.name}</span>
                      <span className="text-[9px] text-slate-500 font-mono">Priority: {r.priority}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                      {r.permissions.canManageChannels && <span className="bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded">Channels</span>}
                      {r.permissions.canManageMessages && <span className="bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded">Mod</span>}
                      <button
                        onClick={async () => {
                          await deleteCustomRole(rolesTargetId, r.id);
                          const updated = await getChatServers();
                          setChatServers(updated);
                        }}
                        className="text-rose-400 hover:text-rose-300 p-1"
                        title="Delete Role"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create New Role Form */}
            <div className="pt-3 border-t border-white/10 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">Add New Custom Role</span>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Role Title</label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    placeholder="e.g. Code Reviewer"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Priority (1-100)</label>
                  <input
                    type="number"
                    value={newRolePriority}
                    onChange={e => setNewRolePriority(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Role Color Accent</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={e => setNewRoleColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <div className="flex items-center gap-1.5">
                    {['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewRoleColor(c)}
                        style={{ backgroundColor: c }}
                        className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Permissions Granted</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRolePerms.canSendMessages}
                      onChange={e => setNewRolePerms(p => ({ ...p, canSendMessages: e.target.checked }))}
                    />
                    <span className="text-slate-300 text-[11px]">Send Messages</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRolePerms.canAttachFiles}
                      onChange={e => setNewRolePerms(p => ({ ...p, canAttachFiles: e.target.checked }))}
                    />
                    <span className="text-slate-300 text-[11px]">Attach Files</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRolePerms.canManageMessages}
                      onChange={e => setNewRolePerms(p => ({ ...p, canManageMessages: e.target.checked }))}
                    />
                    <span className="text-slate-300 text-[11px]">Manage Messages</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRolePerms.canManageChannels}
                      onChange={e => setNewRolePerms(p => ({ ...p, canManageChannels: e.target.checked }))}
                    />
                    <span className="text-slate-300 text-[11px]">Manage Channels</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  onClick={() => setShowManageRolesModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveCustomRole}
                  disabled={!newRoleName.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  Save Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: MESSAGE READ RECEIPTS & UNREAD RECIPIENTS */}
      {receiptsModalMsg && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => {
                setReceiptsModalMsg(null);
                setReceiptsData(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-sky-500/20 border border-sky-500/30 rounded-2xl text-sky-400">
                <CheckCheck className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-base font-black text-white">Message Read Status</h3>
                <p className="text-xs text-slate-400">Recipient audit & real-time delivery logs.</p>
              </div>
            </div>

            {/* Message snippet preview */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-white/5 text-xs text-slate-300 italic line-clamp-2">
              "{receiptsModalMsg.message}"
            </div>

            {receiptsLoading ? (
              <div className="p-8 text-center text-slate-500 text-xs animate-pulse">
                Inspecting read receipts...
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* READ BY SECTION */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <CheckCheck className="w-4 h-4 text-sky-400" />
                      Read by ({receiptsData?.readBy?.length || 0})
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {(!receiptsData?.readBy || receiptsData.readBy.length === 0) ? (
                      <p className="text-[11px] text-slate-500 italic px-2">No read receipts logged yet.</p>
                    ) : (
                      receiptsData.readBy.map(r => (
                        <div key={r.userId} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-white/5">
                          <div className="flex items-center gap-2">
                            {r.userAvatar ? (
                              <img src={r.userAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                                {r.userName.charAt(0)}
                              </div>
                            )}
                            <span className="text-xs font-bold text-white">{r.userName}</span>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 font-bold">
                              {r.role || 'Member'}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {new Date(r.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* UNREAD BY SECTION */}
                {receiptsData?.unreadBy && receiptsData.unreadBy.length > 0 && (
                  <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Unread by ({receiptsData.unreadBy.length})
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {receiptsData.unreadBy.map(uid => {
                        const u = resolveUser(uid);
                        return (
                          <span key={uid} className="px-2 py-0.5 rounded-lg bg-slate-950 text-slate-400 border border-white/5 text-[10px] font-medium">
                            {u.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: RICH COMMUNITY USER PROFILE CARD */}
      {communityProfileUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-white/10 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl relative"
          >
            <button
              onClick={() => setCommunityProfileUser(null)}
              className="absolute top-3 right-3 text-white/80 hover:text-white p-1 rounded-full bg-black/40 backdrop-blur-md z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Banner */}
            <div className="h-32 w-full relative">
              <img 
                src={communityProfileUser.bannerUrl || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80'} 
                alt="" 
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/30" />
              <div className="absolute bottom-3 left-4 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-black/40 text-white backdrop-blur-md border border-white/10">
                  {communityProfileUser.role.toUpperCase()}
                </span>
                {communityProfileUser.streakDays && communityProfileUser.streakDays > 0 && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 backdrop-blur-md border border-amber-500/30 flex items-center gap-1">
                    <Flame className="w-3 h-3" /> {communityProfileUser.streakDays}
                  </span>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="px-5 pb-6 space-y-4">
              <div className="flex justify-between items-end -mt-10 relative">
                <div className="relative">
                  <div className={`p-1 rounded-2xl ${communityProfileUser.role === 'admin' || communityProfileUser.role === 'super_admin' ? 'bg-gradient-to-tr from-amber-400 via-yellow-500 to-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-800'}`}>
                    {communityProfileUser.avatar || communityProfileUser.photoURL ? (
                      <img
                        src={communityProfileUser.avatar || communityProfileUser.photoURL}
                        alt=""
                        className="w-20 h-20 rounded-xl object-cover ring-4 ring-slate-900 shadow-xl border border-white/10"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-indigo-600 ring-4 ring-slate-900 flex items-center justify-center text-2xl font-black text-white shadow-xl">
                        {communityProfileUser.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className={`w-5 h-5 rounded-full border-4 border-slate-900 ${getStatusColor(communityProfileUser.uid || '')} absolute -bottom-1 -right-1 shadow-lg`} />
                </div>

                <div className="flex flex-col gap-2 items-end">
                  {currentUser?.uid !== communityProfileUser.uid && (
                    <button
                      onClick={async () => {
                        if (!currentUser) return;
                        const room = await getOrCreateDirectMessageRoom(currentUser as any, communityProfileUser as any);
                        if (!chatRooms.some(r => r.id === room.id)) {
                          setChatRooms(prev => [room, ...prev]);
                        }
                        setActiveServerId('home');
                        setActiveChatTargetId(room.id);
                        setCommunityProfileUser(null);
                        showNotification(`Opened direct chat with ${communityProfileUser.name}`);
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 active:scale-95"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </button>
                  )}
                  {isModerator && currentUser?.uid !== communityProfileUser.uid && (
                    <button
                      onClick={() => {
                        setRolesTargetId(activeRoomInfo.id);
                        setShowManageRolesModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Shield className="w-3 h-3" />
                      <span>Manage Roles</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-lg font-black text-white">{communityProfileUser.name}</h4>
                  {getVerificationStatus(communityProfileUser).isVerified && (
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  )}
                </div>
                <p className="text-xs text-slate-500 font-bold tracking-tight">@{communityProfileUser.email.split('@')[0]}</p>
              </div>

              {/* Roles & Badges Row */}
              <div className="flex flex-wrap gap-2">
                {communityProfileUser.role === 'super_admin' && (
                  <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                    <ShieldAlert size={10} /> Root Admin
                  </span>
                )}
                {communityProfileUser.role === 'admin' && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                    <ShieldCheck size={10} /> Campus Admin
                  </span>
                )}
                {(communityProfileUser.badges || []).slice(0, 4).map((badge, bIdx) => (
                  <span key={bIdx} className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                    <Award size={10} /> {badge.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>

              <div className="space-y-3">
                {/* About Section */}
                <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 space-y-1.5">
                  <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">About Member</h5>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    {communityProfileUser.bio ? (
                      <p className="italic">"{communityProfileUser.bio}"</p>
                    ) : (
                      <p className="opacity-50">No bio provided by user.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 pt-1.5">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Class</p>
                      <p className="text-xs text-slate-200 font-bold">{communityProfileUser.grade || 'G10'} • {communityProfileUser.section || 'S'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">House</p>
                      <p className="text-xs font-black text-indigo-400">{communityProfileUser.house || 'Ruby'}</p>
                    </div>
                  </div>
                </div>

                {/* Mutual Servers Section */}
                <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Mutual Servers</h5>
                  <div className="flex -space-x-2">
                    {chatServers
                      .filter(s => s.members?.includes(communityProfileUser.uid || '') && s.members?.includes(currentUser?.uid || ''))
                      .slice(0, 5)
                      .map(s => (
                        <div 
                          key={s.id} 
                          title={s.name}
                          className="w-8 h-8 rounded-xl bg-slate-900 border-2 border-slate-950 flex items-center justify-center text-sm shadow-md hover:-translate-y-1 transition-transform cursor-help"
                        >
                          {s.icon}
                        </div>
                      ))}
                    {chatServers.filter(s => s.members?.includes(communityProfileUser.uid || '') && s.members?.includes(currentUser?.uid || '')).length === 0 && (
                      <p className="text-[10px] text-slate-600 font-medium italic">No mutual servers found.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL 6: JOIN SERVER BY CODE */}
      {showJoinServerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4"
          >
            <button
              onClick={() => setShowJoinServerModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Join a Community Guild</h3>
                <p className="text-xs text-slate-400">Enter a server invite code or select a community</p>
              </div>
            </div>

            {joinServerError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{joinServerError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Server Code</label>
              <input
                type="text"
                value={joinServerCodeInput}
                onChange={(e) => setJoinServerCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoinServerByCode();
                }}
                placeholder="e.g. CAMPUS, ROBOTICS, STATED"
                className="w-full bg-slate-950 border border-white/15 rounded-2xl px-4 py-3 text-sm font-mono tracking-widest text-white uppercase placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Quick-Join Public Community Chips */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Quick Join Featured Communities</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: 'server_campus_main', name: '🏛️ Campus Central' },
                  { code: 'server_stem_society', name: '⚡ STEM Society' },
                  { code: 'server_academic_houses', name: '🛡️ Academic Houses' }
                ].map(item => (
                  <button
                    key={item.code}
                    onClick={() => {
                      setJoinServerCodeInput(item.code);
                      handleJoinServerByCode(item.code);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setShowJoinServerModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                disabled={joinServerLoading || !joinServerCodeInput.trim()}
                onClick={() => handleJoinServerByCode()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                {joinServerLoading ? (
                  <span>Joining...</span>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>Join Server</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL 7: SERVER INVITE & ADD MEMBERS */}
      {showServerInviteModal && (() => {
        const currentServer = chatServers.find(s => s.id === activeServerId) || chatServers[0];
        const serverCode = currentServer?.inviteCode || currentServer?.id.split('_').pop()?.toUpperCase() || 'SERVER';
        const filteredUsers = availableUsersList.filter(u => {
          if (!serverInviteSearchQuery) return true;
          const q = serverInviteSearchQuery.toLowerCase();
          return u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)) || (u.role && u.role.toLowerCase().includes(q));
        });

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5"
            >
              <button
                onClick={() => setShowServerInviteModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 bg-slate-950 border border-white/10 rounded-2xl">{currentServer?.icon || '🏰'}</span>
                <div>
                  <h3 className="text-lg font-black text-white">Invite to {currentServer?.name}</h3>
                  <p className="text-xs text-slate-400">Share code or add members directly to this server</p>
                </div>
              </div>

              {/* Share Code Section */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-2">
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Server Invite Code</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm font-bold text-white tracking-widest select-all">
                    {serverCode}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(serverCode);
                      showNotification(`Copied invite code: ${serverCode}`);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95 shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Code</span>
                  </button>
                </div>
              </div>

              {/* Add Member Direct Search Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Add StudentOS Member</span>
                  <span className="text-[10px] text-slate-500">{filteredUsers.length} members found</span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={serverInviteSearchQuery}
                    onChange={(e) => setServerInviteSearchQuery(e.target.value)}
                    placeholder="Search by user name, email, or role..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {filteredUsers.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No matching members found.</p>
                  ) : (
                    filteredUsers.map(user => {
                      const isAlreadyInServer = (currentServer?.members || []).includes(user.uid || '');
                      return (
                        <div
                          key={user.uid || user.email}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-white/10 transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {user.avatar || user.photoURL ? (
                              <img src={user.avatar || user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {user.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{user.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{user.role.toUpperCase()} • {user.grade || 'G10'}</p>
                            </div>
                          </div>

                          {isAlreadyInServer ? (
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1 shrink-0">
                              <Check className="w-3 h-3" /> Member
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddUserToServer(currentServer, user)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-md transition-all flex items-center gap-1 active:scale-95 shrink-0"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-white/10">
                <button
                  onClick={() => setShowServerInviteModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* MODAL 8: UNIFIED SERVER SETTINGS */}
      {showServerSettingsModal && (() => {
        const currentServer = chatServers.find(s => s.id === activeServerId) || chatServers[0];
        if (!currentServer) return null;
        const serverOwner = currentServer.ownerId;
        const isOwner = currentUser?.uid === serverOwner || currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
        const serverCode = currentServer.inviteCode || currentServer.id.split('_').pop()?.toUpperCase() || 'SERVER';
        const filteredUsers = availableUsersList.filter(u => {
          if (!serverInviteSearchQuery) return true;
          const q = serverInviteSearchQuery.toLowerCase();
          return u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q));
        });

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative space-y-5 max-h-[90vh] flex flex-col"
            >
              <button
                onClick={() => setShowServerSettingsModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-3xl p-2 bg-slate-950 border border-white/10 rounded-2xl">{currentServer.icon || '🏰'}</span>
                <div>
                  <h3 className="text-lg font-black text-white">{currentServer.name} — Settings</h3>
                  <p className="text-xs text-slate-400">Manage server info, members, and custom roles</p>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex gap-2 border-b border-white/10 pb-3 shrink-0">
                {[
                  { id: 'info', label: 'Info & Invite' },
                  { id: 'members', label: `Members (${(currentServer.members || []).length})` },
                  { id: 'roles', label: `Roles (${(currentServer.roles || []).length})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setServerSettingsTab(tab.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${serverSettingsTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {/* TAB 1: INFO & INVITE & OWNER ACTIONS */}
                {serverSettingsTab === 'info' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-2">
                      <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Server Invite Code</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm font-bold text-white tracking-widest select-all">
                          {serverCode}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(serverCode);
                            showNotification(`Copied invite code: ${serverCode}`);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95 shrink-0"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Copy Code</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Server Details</h4>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Server Name</label>
                        <input
                          type="text"
                          defaultValue={currentServer.name}
                          onBlur={async (e) => {
                            const val = e.target.value.trim();
                            if (!val || val === currentServer.name) return;
                            const updated = { ...currentServer, name: val };
                            await saveChatServer(updated);
                            setChatServers(prev => prev.map(s => s.id === currentServer.id ? updated : s));
                            showNotification('Server name updated.');
                          }}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Description</label>
                        <textarea
                          defaultValue={currentServer.description}
                          onBlur={async (e) => {
                            const val = e.target.value.trim();
                            if (val === currentServer.description) return;
                            const updated = { ...currentServer, description: val };
                            await saveChatServer(updated);
                            setChatServers(prev => prev.map(s => s.id === currentServer.id ? updated : s));
                            showNotification('Server description updated.');
                          }}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white resize-none h-16"
                        />
                      </div>
                    </div>

                    {/* Owner Danger / Admin Zone */}
                    {isOwner && (
                      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-wider text-rose-400">Owner Management & Danger Zone</h4>
                        
                        {/* Transfer Ownership */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-rose-300 uppercase">Transfer Server Ownership</label>
                          <div className="flex gap-2">
                            <select
                              value={transferOwnerTargetUid}
                              onChange={(e) => setTransferOwnerTargetUid(e.target.value)}
                              className="flex-1 bg-slate-900 border border-rose-500/30 text-white text-xs rounded-xl px-3 py-2"
                            >
                              <option value="">Select new owner...</option>
                              {(currentServer.members || []).filter(uid => uid !== serverOwner).map(uid => {
                                const u = resolveUser(uid);
                                return <option key={uid} value={uid}>{u.name} ({u.email})</option>;
                              })}
                            </select>
                            <button
                              disabled={!transferOwnerTargetUid}
                              onClick={async () => {
                                if (!transferOwnerTargetUid) return;
                                const newOwner = resolveUser(transferOwnerTargetUid);
                                if (!confirm(`Transfer ownership of ${currentServer.name} to ${newOwner.name}?`)) return;
                                try {
                                  const updated = await transferServerOwnership(currentServer.id, transferOwnerTargetUid);
                                  setChatServers(prev => prev.map(s => s.id === currentServer.id ? updated : s));
                                  showNotification(`Ownership transferred to ${newOwner.name}`);
                                  setTransferOwnerTargetUid('');
                                } catch (err: any) {
                                  showNotification(err.message || 'Failed to transfer ownership');
                                }
                              }}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shrink-0"
                            >
                              Transfer
                            </button>
                          </div>
                        </div>

                        {/* Delete Server */}
                        <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-white">Delete Server</p>
                            <p className="text-[10px] text-slate-400">Permanently delete this server and its channels for all members.</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm(`Are you absolutely sure you want to delete ${currentServer.name}? This cannot be undone.`)) return;
                              try {
                                await deleteChatServer(currentServer.id);
                                setChatServers(prev => prev.filter(s => s.id !== currentServer.id));
                                setActiveServerId('home');
                                setShowServerSettingsModal(false);
                                showNotification(`Server "${currentServer.name}" deleted.`);
                              } catch (err: any) {
                                showNotification(err.message || 'Failed to delete server');
                              }
                            }}
                            className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-black rounded-xl shadow-lg transition-all"
                          >
                            Delete Server
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: MEMBERS */}
                {serverSettingsTab === 'members' && (
                  <div className="space-y-4">
                    {isOwner && (
                      <div className="p-3 rounded-2xl bg-slate-950 border border-white/10 space-y-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Add Member to Server</span>
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={serverInviteSearchQuery}
                            onChange={(e) => setServerInviteSearchQuery(e.target.value)}
                            placeholder="Search user name or email..."
                            className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500"
                          />
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                          {filteredUsers.map(user => {
                            const isAlready = (currentServer.members || []).includes(user.uid || '');
                            if (isAlready) return null;
                            return (
                              <div key={user.uid} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-white/5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                    {user.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{user.name}</p>
                                    <p className="text-[9px] text-slate-400 truncate">{user.email}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={async () => {
                                    const updatedMembers = Array.from(new Set([...(currentServer.members || []), user.uid]));
                                    const updatedServer = { ...currentServer, members: updatedMembers };
                                    await saveChatServer(updatedServer);
                                    setChatServers(prev => prev.map(s => s.id === currentServer.id ? updatedServer : s));
                                    showNotification(`Added ${user.name} to server`);
                                  }}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg shadow"
                                >
                                  Add
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {(currentServer.members || []).map(memberUid => {
                        const memberUser = resolveUser(memberUid);
                        const isMemberOwner = memberUid === serverOwner;
                        const isMuted = (currentServer.mutedMembers || []).includes(memberUid);
                        const assignedRoleId = currentServer.memberRoles?.[memberUid];
                        const assignedRole = (currentServer.roles || []).find(r => r.id === assignedRoleId);

                        return (
                          <div key={memberUid} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-white/5 gap-2">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {memberUser.avatar || memberUser.photoURL ? (
                                <img src={memberUser.avatar || memberUser.photoURL} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                  {memberUser.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-white truncate">{memberUser.name}</p>
                                  {isMemberOwner && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[8px] font-black uppercase">
                                      Owner
                                    </span>
                                  )}
                                  {isMuted && (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[8px] font-black uppercase">
                                      Muted
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {assignedRole ? (
                                    <span 
                                      style={{ backgroundColor: `${assignedRole.color}20`, color: assignedRole.color, borderColor: `${assignedRole.color}40` }}
                                      className="px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: assignedRole.color }} />
                                      {assignedRole.name}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 capitalize">{memberUser.role}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isOwner && !isMemberOwner && (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const updated = await muteServerMember(currentServer.id, memberUid, !isMuted);
                                        setChatServers(prev => prev.map(s => s.id === currentServer.id ? updated : s));
                                        showNotification(isMuted ? `Unmuted ${memberUser.name}` : `Muted ${memberUser.name}`);
                                      } catch (err: any) {
                                        showNotification(err.message || 'Failed to update mute');
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-colors ${isMuted ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-300 border-white/10'}`}
                                  >
                                    {isMuted ? 'Unmute' : 'Mute'}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Remove ${memberUser.name} from server?`)) return;
                                      try {
                                        const updated = await removeServerMember(currentServer.id, memberUid);
                                        setChatServers(prev => prev.map(s => s.id === currentServer.id ? updated : s));
                                        showNotification(`Removed ${memberUser.name} from server.`);
                                      } catch (err: any) {
                                        showNotification(err.message || 'Failed to remove member');
                                      }
                                    }}
                                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 text-xs transition-colors"
                                    title="Remove Member"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: ROLES */}
                {serverSettingsTab === 'roles' && (
                  <div className="space-y-4">
                    {/* Create Role Form (Owner / Admin Only) */}
                    {isOwner && (
                      <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Create New Custom Role</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="Role Name (e.g. Moderator)"
                            className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={newRoleColor}
                              onChange={(e) => setNewRoleColor(e.target.value)}
                              className="w-8 h-8 rounded-lg bg-slate-900 border border-white/10 cursor-pointer"
                            />
                            <span className="text-xs text-slate-400 font-mono">{newRoleColor}</span>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (!newRoleName.trim()) return;
                            const roleId = `role-${Date.now()}`;
                            const newRole: CustomRole = {
                              id: roleId,
                              serverId: currentServer.id,
                              name: newRoleName.trim(),
                              color: newRoleColor,
                              priority: 50,
                              permissions: { canSendMessages: true, canAttachFiles: true, canManageMessages: true, canManageChannels: false, canManageRoles: false }
                            };
                            const updatedRoles = [...(currentServer.roles || []), newRole];
                            const updatedServer = { ...currentServer, roles: updatedRoles };
                            await saveChatServer(updatedServer);
                            setChatServers(prev => prev.map(s => s.id === currentServer.id ? updatedServer : s));
                            setNewRoleName('');
                            showNotification(`Created role "${newRole.name}"`);
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                        >
                          Create Role
                        </button>
                      </div>
                    )}

                    {/* Roles & Member Role Assignment List */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Roles</h4>
                      {(currentServer.members || []).map(memberUid => {
                        const memberUser = resolveUser(memberUid);
                        const isMemberOwner = memberUid === serverOwner;
                        const assignedRoleId = currentServer.memberRoles?.[memberUid];
                        const assignedRole = (currentServer.roles || []).find(r => r.id === assignedRoleId);

                        return (
                          <div key={memberUid} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-white/5 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {memberUser.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{memberUser.name}</p>
                                {assignedRole ? (
                                  <span style={{ color: assignedRole.color }} className="text-[10px] font-bold">
                                    {assignedRole.name}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500">No Role</span>
                                )}
                              </div>
                            </div>

                            {/* Only server owner / admin can change role dropdown. Normal members see view-only label. */}
                            {isOwner ? (
                              <select
                                value={assignedRoleId || ''}
                                onChange={async (e) => {
                                  const newRoleId = e.target.value;
                                  const updatedRoles = { ...(currentServer.memberRoles || {}) };
                                  if (newRoleId) {
                                    updatedRoles[memberUid] = newRoleId;
                                  } else {
                                    delete updatedRoles[memberUid];
                                  }
                                  const updatedServer = { ...currentServer, memberRoles: updatedRoles };
                                  await saveChatServer(updatedServer);
                                  setChatServers(prev => prev.map(s => s.id === currentServer.id ? updatedServer : s));
                                  showNotification(`Role updated for ${memberUser.name}`);
                                }}
                                className="bg-slate-900 border border-white/10 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                              >
                                <option value="">(No Custom Role)</option>
                                {(currentServer.roles || []).map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium px-2 py-1 bg-slate-900 rounded-xl">
                                {assignedRole ? assignedRole.name : 'View Only'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-white/10 shrink-0">
                <button
                  onClick={() => setShowServerSettingsModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </>
  );
};
