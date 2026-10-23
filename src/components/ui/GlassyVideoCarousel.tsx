/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Glassy Video Carousel Component
 * Renders educational video recommendations in a soft frosted glass carousel
 * with blur, previous/next navigation arrows, indicator dots, and manual tap-to-open button.
 * Strictly no autoplay.
 */

import React, { useState } from 'react';
import { Play, ExternalLink, ChevronLeft, ChevronRight, Video, Sparkles } from 'lucide-react';

export interface EducationalVideoItem {
  id: string;
  title: string;
  channel: string;
  url: string;
  thumbnail: string;
  reason: string;
}

interface GlassyVideoCarouselProps {
  videos: EducationalVideoItem[];
  queryTopic?: string;
  onOpenVideo?: (url: string) => void;
}

export const GlassyVideoCarousel: React.FC<GlassyVideoCarouselProps> = ({
  videos,
  queryTopic = 'Educational Topic',
  onOpenVideo
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!videos || videos.length === 0) return null;

  const currentVideo = videos[currentIndex] || videos[0];

  const handlePrev = () => {
    setCurrentIndex(prev => (prev === 0 ? videos.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev === videos.length - 1 ? 0 : prev + 1));
  };

  const handleOpen = () => {
    const targetUrl = currentVideo.url || `https://www.youtube.com/watch?v=${currentVideo.id}`;
    if (onOpenVideo) {
      onOpenVideo(targetUrl);
    } else if (typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="smart-glass p-5 rounded-3xl bg-slate-950/80 backdrop-blur-xl border border-indigo-500/30 space-y-4 shadow-2xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono">Curated Educational Video Suggestions</h4>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {videos.length} Videos
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Selected for "{queryTopic}" • Trusted YouTube Education</p>
          </div>
        </div>

        {/* Previous / Next Arrows */}
        {videos.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
              title="Previous video"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
              title="Next video"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Active Featured Glassy Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-slate-900/90 border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:border-indigo-500/40 shadow-xl">
        {/* Thumbnail Viewport (No Autoplay) */}
        <div 
          onClick={handleOpen}
          className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-white/10 group cursor-pointer flex items-center justify-center shadow-lg"
        >
          <img
            src={currentVideo.thumbnail || `https://img.youtube.com/vi/${currentVideo.id}/hqdefault.jpg`}
            alt={currentVideo.title}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop';
            }}
          />
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-all">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] font-mono font-bold text-white uppercase tracking-wider border border-white/10">
            YouTube Education
          </span>
        </div>

        {/* Video Metadata & Reason */}
        <div className="md:col-span-2 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">
                {currentVideo.channel || 'Educational Channel'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Video {currentIndex + 1} of {videos.length}
              </span>
            </div>
            <h3 className="text-sm font-black text-white leading-snug">{currentVideo.title}</h3>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-white/5 space-y-1">
            <span className="text-[9px] font-bold text-teal-400 uppercase tracking-wider block font-mono">💡 Why this video:</span>
            <p className="text-xs text-slate-300 leading-relaxed italic">"{currentVideo.reason}"</p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleOpen}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Video in YouTube</span>
            </button>
            <span className="text-[10px] text-slate-500 font-mono">Tap to open • No autoplay</span>
          </div>
        </div>
      </div>

      {/* Dots Indicator */}
      {videos.length > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          {videos.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === currentIndex ? 'w-6 bg-indigo-500' : 'w-2 bg-white/20 hover:bg-white/40'
              }`}
              title={`Go to video ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
