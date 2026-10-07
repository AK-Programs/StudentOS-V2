/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Global School Call Modal & Active Call Overlay
 * Renders on top of all application views with rich school context,
 * participant grids, WebRTC streaming, and classroom controls.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Users, UserPlus,
  Maximize2, Minimize2, Sparkles, BookOpen, GraduationCap, X, Check,
  Volume2, Shield, Share2, Layers, AlertCircle
} from 'lucide-react';
import {
  SchoolCallSession,
  CallParticipant,
  subscribeCallState,
  acceptSchoolCall,
  declineSchoolCall,
  endSchoolCall,
  toggleCallAudio,
  toggleCallVideo,
  addParticipantToCall
} from '../../lib/callService';
import { UserProfile, UserRole } from '../../types';

interface GlobalSchoolCallModalProps {
  currentUser: UserProfile | null;
  effectiveRole?: string;
  allUsers?: UserProfile[];
  onNavigateTab?: (tab: string) => void;
}

export const GlobalSchoolCallModal: React.FC<GlobalSchoolCallModalProps> = ({
  currentUser,
  effectiveRole,
  allUsers = [],
  onNavigateTab
}) => {
  const [session, setSession] = useState<SchoolCallSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const durationTimerRef = useRef<any>(null);

  // Subscribe to call session state
  useEffect(() => {
    const unsub = subscribeCallState((newSession) => {
      setSession(newSession);
      if (newSession && (newSession.status === 'CONNECTED' || newSession.status === 'RINGING')) {
        setIsMinimized(false);
      }
    });
    return () => unsub();
  }, []);

  // Call duration counter
  useEffect(() => {
    if (session?.status === 'CONNECTED') {
      const startTime = session.acceptedAt || Date.now();
      durationTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setCallDuration(0);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [session?.status]);

  // Bind local video stream
  useEffect(() => {
    if (localVideoRef.current && session?.caller?.stream) {
      if (localVideoRef.current.srcObject !== session.caller.stream) {
        localVideoRef.current.srcObject = session.caller.stream;
      }
    }
  }, [session?.caller?.stream, isVideoOff, session?.status]);

  if (!session || !currentUser) return null;

  const isIncoming = session.status === 'RINGING' && !session.isHost;
  const isOutgoing = session.status === 'RINGING' && session.isHost;
  const isConnected = session.status === 'CONNECTED';

  // Format call duration MM:SS
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Get context icon & color theme
  const getContextBadge = () => {
    switch (session.contextType) {
      case 'class_call':
        return { icon: '🏫', label: 'Classroom Call', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'assignment_call':
        return { icon: '📝', label: 'Assignment Discussion', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
      case 'lecture_call':
        return { icon: '📖', label: 'Lesson Consultation', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      case 'staff_call':
        return { icon: '👔', label: 'Faculty Staff Call', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'student_call':
        return { icon: '🎓', label: 'Student Advisory', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };
      default:
        return { icon: '📞', label: 'Direct Call', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    }
  };

  const contextBadge = getContextBadge();

  // Filter available participants for the add drawer
  const availableUsers = allUsers.filter(u => {
    if (u.uid === currentUser.uid) return false;
    if (session.participants.some(p => p.uid === u.uid)) return false;
    if (!addSearchQuery) return true;
    const q = addSearchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.grade && u.grade.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  // ----------------------------------------------------
  // 1. INCOMING CALL RINGING MODAL
  // ----------------------------------------------------
  if (isIncoming) {
    return (
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xl z-[99999] flex items-center justify-center p-4 animate-fadeIn">
        <div className="smart-glass max-w-md w-full p-6 sm:p-8 rounded-3xl border border-indigo-500/30 space-y-6 shadow-[0_0_50px_rgba(79,70,229,0.3)] text-center relative overflow-hidden">
          
          {/* Glowing pulse rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 rounded-full border border-indigo-500/20 animate-ping" />
            <div className="w-72 h-72 rounded-full border border-indigo-500/10 animate-pulse" />
          </div>

          {/* Context Tag Header */}
          <div className="relative z-10 flex flex-col items-center gap-1.5">
            <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${contextBadge.color}`}>
              <span>{contextBadge.icon}</span>
              <span>{contextBadge.label}</span>
            </div>
            {session.contextTitle && (
              <h4 className="text-xs text-slate-300 font-bold max-w-xs truncate mt-0.5">
                {session.contextTitle}
              </h4>
            )}
          </div>

          {/* Caller Avatar & Name */}
          <div className="relative z-10 space-y-3">
            <div className="relative inline-block">
              {session.caller.avatar ? (
                <img
                  src={session.caller.avatar}
                  alt={session.caller.name}
                  className="w-24 h-24 rounded-3xl object-cover ring-4 ring-indigo-500/40 shadow-2xl mx-auto"
                />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-3xl flex items-center justify-center mx-auto shadow-2xl border-2 border-white/20">
                  {session.caller.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 absolute -top-1 -right-1 animate-ping" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black font-display text-white tracking-tight">
                {session.caller.name}
              </h3>
              <p className="text-xs text-slate-400 capitalize flex items-center justify-center gap-2">
                <span className="font-semibold text-indigo-300">{session.caller.role}</span>
                {session.caller.grade && <span>• {session.caller.grade}</span>}
                {session.caller.section && <span>({session.caller.section})</span>}
              </p>
            </div>
          </div>

          {/* Call Mode Indicator */}
          <div className="relative z-10 py-1 text-xs font-mono font-bold text-indigo-400 flex items-center justify-center gap-1.5">
            {session.type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            <span>Incoming {session.type === 'video' ? 'Video Call' : 'Voice Call'}...</span>
          </div>

          {/* Accept / Decline Action Buttons */}
          <div className="relative z-10 flex items-center justify-center gap-8 pt-2">
            {/* Decline */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => declineSchoolCall(session.callId, 'declined_by_user', currentUser)}
                className="w-16 h-16 rounded-3xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 hover:scale-105 active:scale-95 transition-all"
                title="Decline Call"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Decline</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => acceptSchoolCall(session.callId, currentUser)}
                className="w-16 h-16 rounded-3xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 hover:scale-105 active:scale-95 transition-all"
                title="Accept Call"
              >
                <Phone className="w-7 h-7" />
              </button>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Accept</span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 2. MINIMIZED FLOATING CALL PILL
  // ----------------------------------------------------
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-[99999] bg-slate-900/95 border border-indigo-500/40 rounded-2xl p-3 shadow-2xl flex items-center gap-3 animate-slideUp backdrop-blur-md">
        <div className="relative">
          <span className="w-3 h-3 rounded-full bg-emerald-500 block animate-pulse" />
        </div>
        <div className="space-y-0.5 max-w-[140px] truncate">
          <p className="text-xs font-bold text-white truncate">{session.contextTitle || session.caller.name}</p>
          <p className="text-[10px] font-mono text-emerald-400 font-bold">{formatDuration(callDuration)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
            title="Expand Call"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => endSchoolCall('user_ended_minimized')}
            className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white"
            title="Hang Up"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 3. FULL ACTIVE / CONNECTING CALL SCREEN
  // ----------------------------------------------------
  const remoteParticipants = session.participants.filter(p => p.uid !== currentUser.uid);

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[99999] flex flex-col justify-between p-3 sm:p-5 animate-fadeIn select-none font-sans">
      
      {/* Top Bar: Context & Call Metadata */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-white/10 p-3 sm:p-4 rounded-2xl shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-xl border text-base shrink-0 ${contextBadge.color}`}>
            {contextBadge.icon}
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-white truncate">
                {session.contextTitle || 'StudentOS Call Session'}
              </h3>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border hidden sm:inline ${contextBadge.color}`}>
                {contextBadge.label}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {session.status === 'CONNECTED' ? (
                <span className="font-mono text-emerald-400 font-bold">⏱️ {formatDuration(callDuration)} • Connected</span>
              ) : isOutgoing ? (
                <span className="text-amber-400 font-semibold animate-pulse">Calling participants...</span>
              ) : (
                <span className="text-indigo-400 font-semibold">Connecting...</span>
              )}
              {session.contextSubtitle && <span className="hidden md:inline"> • {session.contextSubtitle}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowAddDrawer(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Add Authorized Student or Teacher"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add People</span>
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
            title="Minimize to Floating Pill"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Video & Audio Grid */}
      <div className="flex-1 my-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto min-h-0">
        {/* Remote Participants */}
        {remoteParticipants.map(part => (
          <div
            key={part.uid}
            className="relative bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden flex items-center justify-center min-h-[160px] sm:min-h-[200px]"
          >
            {part.stream && session.type === 'video' && !part.isVideoOff ? (
              <video
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && part.stream && el.srcObject !== part.stream) {
                    el.srcObject = part.stream;
                  }
                }}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="space-y-2 text-center p-4">
                {part.avatar ? (
                  <img src={part.avatar} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover mx-auto ring-2 ring-white/10" />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-800 text-white font-black text-xl flex items-center justify-center mx-auto border border-white/10">
                    {part.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-xs font-bold text-white truncate max-w-[150px] mx-auto">{part.name}</p>
                <span className="text-[9px] font-mono uppercase text-slate-400 px-2 py-0.5 bg-white/5 rounded-full">
                  {part.status === 'connected' ? (part.isMuted ? 'Muted' : 'Speaking') : part.status === 'ringing' ? 'Ringing...' : part.status}
                </span>
              </div>
            )}

            {/* Remote Audio Track Element for sound playback */}
            {part.stream && (
              <audio
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && part.stream && el.srcObject !== part.stream) {
                    el.srcObject = part.stream;
                  }
                }}
              />
            )}

            {/* Bottom Overlay Label */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[10px] text-white">
              <span className="font-bold truncate max-w-[70%]">{part.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {part.isMuted ? <MicOff className="w-3 h-3 text-rose-400" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                {session.type === 'video' && (part.isVideoOff ? <VideoOff className="w-3 h-3 text-rose-400" /> : <Video className="w-3 h-3 text-emerald-400" />)}
              </div>
            </div>
          </div>
        ))}

        {/* Local Stream Tile */}
        <div className="relative bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden flex items-center justify-center min-h-[160px] sm:min-h-[200px]">
          {session.type === 'video' && !isVideoOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="space-y-2 text-center p-4">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover mx-auto ring-2 ring-indigo-500/40" />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-600 text-white font-black text-xl flex items-center justify-center mx-auto border border-white/20">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="text-xs font-bold text-white truncate max-w-[150px] mx-auto">{currentUser.name} (You)</p>
              <span className="text-[9px] font-mono uppercase text-indigo-400 px-2 py-0.5 bg-indigo-500/10 rounded-full font-bold">
                {effectiveRole || currentUser.role}
              </span>
            </div>
          )}

          {/* Bottom Overlay Label */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[10px] text-white">
            <span className="font-bold">You</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {isMuted ? <MicOff className="w-3 h-3 text-rose-400" /> : <Mic className="w-3 h-3 text-emerald-400" />}
              {session.type === 'video' && (isVideoOff ? <VideoOff className="w-3 h-3 text-rose-400" /> : <Video className="w-3 h-3 text-emerald-400" />)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 bg-slate-900/90 border border-white/10 p-3 sm:p-4 rounded-2xl shrink-0">
        {/* Mic Toggle */}
        <button
          onClick={() => {
            const next = !isMuted;
            setIsMuted(next);
            toggleCallAudio(next);
          }}
          className={`p-3.5 rounded-2xl font-bold transition-all ${
            isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Video Camera Toggle */}
        {session.type === 'video' && (
          <button
            onClick={() => {
              const next = !isVideoOff;
              setIsVideoOff(next);
              toggleCallVideo(next);
            }}
            className={`p-3.5 rounded-2xl font-bold transition-all ${
              isVideoOff ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750'
            }`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        {/* Add People */}
        <button
          onClick={() => setShowAddDrawer(true)}
          className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold transition-all"
          title="Add Participant"
        >
          <UserPlus className="w-5 h-5" />
        </button>

        {/* End Call Button */}
        <button
          onClick={() => endSchoolCall('user_clicked_end')}
          className="px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-600/30 flex items-center gap-2 text-xs uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
          title="End Call"
        >
          <PhoneOff className="w-5 h-5" />
          <span>End Call</span>
        </button>
      </div>

      {/* ADD PARTICIPANT DRAWER MODAL */}
      {showAddDrawer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100000] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Add Participant to Call</h4>
              </div>
              <button
                onClick={() => setShowAddDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={addSearchQuery}
              onChange={(e) => setAddSearchQuery(e.target.value)}
              placeholder="Search students, teachers, classes..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {availableUsers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No matching school participants found.</p>
              ) : (
                availableUsers.map(user => (
                  <div
                    key={user.uid}
                    className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5 flex items-center justify-between gap-3 hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-400 capitalize truncate">
                          {user.role} {user.grade ? `• ${user.grade}` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        addParticipantToCall(user);
                        setShowAddDrawer(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-wider shrink-0 active:scale-95"
                    >
                      Invite
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
