import React, { useState, useEffect } from 'react';
import { Megaphone, X, BellRing, Sparkles, ShieldAlert, ArrowRight } from 'lucide-react';
import { soundService } from '../lib/soundService';
import { supabase } from '../lib/supabase';

interface LiveBroadcastPayload {
  id: string;
  title: string;
  message: string;
  senderName: string;
  senderRole: string;
  priority: 'normal' | 'urgent' | 'emergency';
  category: string;
  createdAt: string;
}

interface LiveBroadcastBannerProps {
  currentUser?: any;
}

export const LiveBroadcastBanner: React.FC<LiveBroadcastBannerProps> = () => {
  const [activePopup, setActivePopup] = useState<LiveBroadcastPayload | null>(null);
  const [stickyBanner, setStickyBanner] = useState<LiveBroadcastPayload | null>(null);

  useEffect(() => {
    // Subscribe to realtime live broadcasts
    const channel = supabase.channel('student-os-public');
    
    channel.on('broadcast', { event: 'principal_live_broadcast' }, (payload) => {
      if (payload && payload.payload) {
        const broadcast = payload.payload as LiveBroadcastPayload;
        
        // Trigger live popup & sticky banner
        setActivePopup(broadcast);
        setStickyBanner(broadcast);

        // Sound effect
        soundService.playAnnouncementSound();
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      {/* 1. Persistent Top Announcement Banner */}
      {stickyBanner && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-slate-950 px-4 py-2.5 flex items-center justify-between shadow-xl animate-fadeIn z-40 relative">
          <div className="flex items-center gap-3 min-w-0 mx-auto max-w-7xl">
            <span className="p-1.5 rounded-lg bg-black/20 text-white shrink-0">
              <Megaphone className="w-4 h-4 animate-bounce" />
            </span>
            <div className="text-xs font-bold text-white flex items-center gap-2 truncate">
              <span className="px-2 py-0.5 rounded bg-black/30 font-black text-[10px] uppercase tracking-wider text-amber-200 shrink-0">
                {stickyBanner.priority} NOTICE
              </span>
              <span className="font-extrabold text-amber-100 shrink-0">{stickyBanner.title}:</span>
              <span className="font-normal text-white/90 truncate">{stickyBanner.message}</span>
            </div>
          </div>

          <button
            onClick={() => setStickyBanner(null)}
            className="p-1 rounded-lg hover:bg-black/20 text-white/80 hover:text-white shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Instant Realtime Pop-Up Card */}
      {activePopup && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-5 shadow-2xl shadow-amber-950/50 animate-bounceOnce">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                <BellRing className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold text-[10px] uppercase tracking-wider">
                  Live Broadcast
                </span>
                <h4 className="font-black text-white text-base mt-1">
                  {activePopup.title}
                </h4>
              </div>
            </div>

            <button
              onClick={() => setActivePopup(null)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-200 mt-3 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-white/5">
            {activePopup.message}
          </p>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-amber-400">From {activePopup.senderName}</span>
            <span>{new Date(activePopup.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      )}
    </>
  );
};
