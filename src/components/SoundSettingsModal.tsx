/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Global Sound & Audio Settings Modal
 *
 * Integrates all 8 official Pixabay sound effects with live previews,
 * volume controls, category muting, and clear licensing attributions.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Play,
  CheckCircle2,
  ExternalLink,
  X,
  Sliders,
  ShieldCheck,
  Sparkles,
  Music,
  Bell,
  MessageSquare,
  Trophy,
  Award,
  Clock,
  Layers,
  MousePointerClick
} from 'lucide-react';
import {
  soundService,
  PIXABAY_SOUND_CATALOG,
  SoundPreferencesSnapshot,
  SoundCategoryPreferences
} from '../lib/soundService';
import {
  ShimmerButton,
  UIverseToggle,
  CardSpotlight,
  BorderBeam
} from './ui/animatedComponents';

interface SoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [preferences, setPreferences] = useState<SoundPreferencesSnapshot>(() =>
    soundService.getPreferences()
  );
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      soundService.playAppearSound();
    }
  }, [isOpen]);

  useEffect(() => {
    const handlePrefChange = (e: CustomEvent<SoundPreferencesSnapshot>) => {
      setPreferences(e.detail);
    };

    window.addEventListener(
      'studentos-sound-pref-changed',
      handlePrefChange as EventListener
    );
    return () => {
      window.removeEventListener(
        'studentos-sound-pref-changed',
        handlePrefChange as EventListener
      );
    };
  }, []);

  const handleTestSound = (key: string) => {
    setPlayingKey(key);
    soundService.testSound(key);
    setTimeout(() => {
      setPlayingKey(null);
    }, 700);
  };

  const handleToggleMute = () => {
    soundService.toggleMute();
    setPreferences(soundService.getPreferences());
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    soundService.setVolume(newVol);
    setPreferences(soundService.getPreferences());
  };

  const handleToggleCategory = (cat: keyof SoundCategoryPreferences) => {
    const current = preferences.categories[cat];
    soundService.setCategoryEnabled(cat, !current);
    setPreferences(soundService.getPreferences());
  };

  const getCategoryIcon = (category: keyof SoundCategoryPreferences) => {
    switch (category) {
      case 'ui':
        return <MousePointerClick className="w-4 h-4 text-indigo-400" />;
      case 'progression':
        return <Trophy className="w-4 h-4 text-amber-400" />;
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      case 'notifications':
        return <Bell className="w-4 h-4 text-rose-400" />;
      case 'achievements':
        return <Award className="w-4 h-4 text-emerald-400" />;
      case 'gameplay':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'timer':
        return <Clock className="w-4 h-4 text-teal-400" />;
      case 'appear':
        return <Layers className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: 'spring', duration: 0.45, bounce: 0.15 }}
            className="relative w-full max-w-2xl my-6 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            <BorderBeam size={280} duration={14} colorFrom="#6366f1" colorTo="#a855f7" />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                    Sound Effects & Audio
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-extrabold border border-indigo-500/30">
                      Pixabay Audio Suite
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    High-fidelity audio feedback calibrated for StudentOS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundService.playButtonClick();
                  onClose();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="relative z-10 p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
              {/* Master Controls Banner */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`p-3 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                      preferences.muted
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    }`}
                    title={preferences.muted ? 'Unmute All Sounds' : 'Mute All Sounds'}
                  >
                    {preferences.muted ? (
                      <VolumeX className="w-6 h-6" />
                    ) : (
                      <Volume2 className="w-6 h-6" />
                    )}
                  </button>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {preferences.muted ? 'All Sounds Muted' : 'Audio Enabled'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {preferences.muted
                        ? 'Audio muted across the platform'
                        : `Master Volume: ${Math.round(preferences.volume * 100)}%`}
                    </p>
                  </div>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-3 w-full sm:w-64">
                  <Sliders className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    disabled={preferences.muted}
                    value={preferences.volume}
                    onChange={handleVolumeChange}
                    className="w-full h-2 rounded-lg bg-slate-700 accent-indigo-500 cursor-pointer disabled:opacity-40"
                  />
                  <span className="font-mono text-xs font-bold text-slate-300 w-10 text-right">
                    {Math.round(preferences.volume * 100)}%
                  </span>
                </div>
              </div>

              {/* 8 Pixabay Sound Effects Catalog */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">
                    Official Pixabay Sound Effects (8 Integrations)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Preview and toggle per category
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(PIXABAY_SOUND_CATALOG).map(([key, meta]) => {
                    const isEnabled =
                      !preferences.muted && Boolean(preferences.categories[meta.category]);
                    const isPlaying = playingKey === key;

                    return (
                      <div
                        key={key}
                        className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                          isEnabled
                            ? 'bg-slate-800/50 border-white/10 hover:border-indigo-500/30'
                            : 'bg-slate-900/60 border-white/5 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-xl bg-slate-800 border border-white/5">
                              {getCategoryIcon(meta.category)}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                                {meta.name}
                              </h4>
                              <span className="text-[10px] text-slate-400 font-mono">
                                #{meta.id.replace(/[^0-9]/g, '')}
                              </span>
                            </div>
                          </div>

                          <UIverseToggle
                            checked={preferences.categories[meta.category]}
                            disabled={preferences.muted}
                            onChange={() => handleToggleCategory(meta.category)}
                          />
                        </div>

                        <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                          {meta.description}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                          <a
                            href={meta.sourcePage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-indigo-400 hover:text-indigo-300 hover:underline"
                            title="View on Pixabay"
                          >
                            Pixabay Source
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleTestSound(key)}
                            disabled={preferences.muted}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isPlaying
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 scale-95'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 hover:text-white'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            <Play className={`w-3 h-3 ${isPlaying ? 'animate-pulse' : ''}`} />
                            <span>{isPlaying ? 'Playing...' : 'Test Sound'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Licensing and Attribution Banner */}
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-indigo-200/90 text-xs flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-white">
                    Pixabay Content License Verification
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    All 8 integrated audio assets are distributed under the Pixabay Content License,
                    authorized for royalty-free commercial and non-commercial application deployment.
                    Audio assets are hosted locally in <code className="px-1.5 py-0.5 rounded bg-black/40 text-indigo-300 font-mono text-[10px]">/public/sounds/</code> with high-precision Web Audio synthesis fallback.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 px-6 py-4 border-t border-white/10 bg-slate-900/90 flex items-center justify-end">
              <ShimmerButton
                onClick={() => {
                  soundService.playButtonClick();
                  onClose();
                }}
                className="px-6 py-2 text-xs font-bold"
              >
                Done
              </ShimmerButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
