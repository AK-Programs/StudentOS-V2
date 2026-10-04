import React, { useEffect, useRef } from 'react';
import { MicOff, Hand, User, Pin, Maximize2, Volume2, ShieldAlert, Trash2, Sparkles } from 'lucide-react';
import { MeetingParticipant } from '../../types';

interface RemoteVideoTileProps {
  participant: MeetingParticipant;
  stream?: MediaStream | null;
  isScreenSharing?: boolean;
  isPinned?: boolean;
  onPin?: () => void;
  isSpotlighted?: boolean;
  onSpotlight?: () => void;
  onFullscreen?: () => void;
  isSpeaking?: boolean;
  isHost?: boolean;
  onHostMute?: () => void;
  onHostRemove?: () => void;
}

export const RemoteVideoTile: React.FC<RemoteVideoTileProps> = ({
  participant,
  stream,
  isScreenSharing,
  isPinned,
  onPin,
  isSpotlighted,
  onSpotlight,
  onFullscreen,
  isSpeaking,
  isHost,
  onHostMute,
  onHostRemove
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.warn('[StudentOS Meet] Remote video play error:', err);
        });
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream, participant.isCameraOn, isScreenSharing]);

  const hasVideoTrack = stream && stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

  return (
    <div
      onDoubleClick={onPin}
      className={`relative aspect-video bg-slate-900 rounded-3xl border transition-all overflow-hidden shadow-2xl flex items-center justify-center group ${
        isSpeaking ? 'border-emerald-500 shadow-emerald-500/30 ring-2 ring-emerald-500/50' :
        isPinned ? 'border-amber-500/80 shadow-amber-500/20 ring-2 ring-amber-500/40' :
        isScreenSharing ? 'border-teal-500/80 shadow-teal-500/20' : 'border-white/10 hover:border-indigo-500/50'
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${(!participant.isCameraOn || !hasVideoTrack) ? 'hidden' : 'block'}`}
      />

      {(!participant.isCameraOn || !hasVideoTrack) && (
        <div className={`w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 via-violet-600 to-sky-500 text-white flex items-center justify-center text-2xl font-black shadow-lg ${isSpeaking ? 'ring-4 ring-emerald-400 animate-pulse' : ''}`}>
          {participant.name ? participant.name.charAt(0).toUpperCase() : <User className="w-8 h-8" />}
        </div>
      )}

      {/* Participant Badge Overlay */}
      <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/75 backdrop-blur-md rounded-xl text-xs font-extrabold text-white flex items-center gap-2 border border-white/10 z-10 shadow-lg">
        <span className="truncate max-w-[140px]">{participant.name}</span>
        <span className="text-[10px] uppercase font-mono text-indigo-400">({participant.role || participant.userRole})</span>
        {isSpeaking && <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
        {!participant.isMicOn && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
        {participant.isHandRaised && <Hand className="w-3.5 h-3.5 text-amber-400 animate-bounce" />}
      </div>

      {/* Quick Tile Actions Overlay on Hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        {onPin && (
          <button
            onClick={onPin}
            title={isPinned ? 'Unpin participant' : 'Pin participant (Local view)'}
            className={`p-2 rounded-xl border backdrop-blur-md transition-all ${isPinned ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-black/70 text-white border-white/20 hover:bg-slate-800'}`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        )}

        {isHost && onSpotlight && (
          <button
            onClick={onSpotlight}
            title={isSpotlighted ? 'Remove Spotlight' : 'Spotlight for Everyone (Host)'}
            className={`p-2 rounded-xl border backdrop-blur-md transition-all ${isSpotlighted ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/40 animate-pulse' : 'bg-black/70 text-indigo-300 border-white/20 hover:bg-slate-800'}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        )}

        {onFullscreen && (
          <button
            onClick={onFullscreen}
            title="Fullscreen Video"
            className="p-2 rounded-xl bg-black/70 text-white border border-white/20 hover:bg-slate-800 backdrop-blur-md transition-all"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {isHost && onHostMute && participant.isMicOn && (
          <button
            onClick={onHostMute}
            title="Mute Participant (Host)"
            className="p-2 rounded-xl bg-rose-500/80 text-white border border-rose-400 hover:bg-rose-600 backdrop-blur-md transition-all"
          >
            <MicOff className="w-3.5 h-3.5" />
          </button>
        )}

        {isHost && onHostRemove && (
          <button
            onClick={onHostRemove}
            title="Remove from Meeting (Host)"
            className="p-2 rounded-xl bg-rose-700/80 text-white border border-rose-500 hover:bg-rose-800 backdrop-blur-md transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isScreenSharing && (
        <div className="absolute top-3 left-3 px-2.5 py-1 bg-teal-500/20 border border-teal-500/40 rounded-full text-[10px] font-mono font-black text-teal-300 uppercase z-10">
          Screen Sharing
        </div>
      )}
    </div>
  );
};
