/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Winter Festival Audio Manager:
 * - Syncs with StudentOS global soundService mute, volume, and category preferences.
 * - Ambient Solstice Soundscape uses explicit opt-in playback ONLY (no autoplay).
 * - SFX trigger verified local Pixabay WAV/MP3 cues (/public/sounds/*) and crisp polyphonic Web Audio celesta synthesis.
 */

import { soundService } from './soundService';

const AMBIENT_STORAGE_KEY = 'veylentra_winter_ambient_enabled';

export interface WinterAudioAttributionItem {
  id: string;
  label: string;
  source: string;
  license: string;
  asset: string;
}

export const WINTER_AUDIO_ATTRIBUTIONS: WinterAudioAttributionItem[] = [
  {
    id: 'winter_ambient_celesta',
    label: 'Winter Solstice Celesta Ambience (Loop)',
    source: 'In-app Web Audio Polyphonic Synthesizer (built cleanly inside StudentOS/Veylentra)',
    license: 'Apache-2.0 (First-party original synthesis, zero third-party copyright)',
    asset: 'src/lib/winterAudio.ts (C minor / Eb Major pentatonic celesta pad)',
  },
  {
    id: 'frost_xp_earned',
    label: 'Frost XP & Quiz Chime',
    source: 'Pixabay Sound Effect #6033',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    asset: '/sounds/correct-answer.wav',
  },
  {
    id: 'winter_purchase_success',
    label: 'Collectible Unlock Fanfare',
    source: 'Pixabay Sound Effect #402152',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    asset: '/sounds/level-up-08-402152.wav',
  },
  {
    id: 'banner_border_equip',
    label: 'Banner & Border Equip Cue',
    source: 'Pixabay Sound Effect #8367',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    asset: '/sounds/transitions-appear-sound-effect-short-8367.wav',
  },
  {
    id: 'winter_badge_earned',
    label: 'Seasonal Badge Unlocked',
    source: 'Pixabay Sound Effect #203875',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    asset: '/sounds/achievement-unlocked-2-203875.wav',
  },
];

class WinterAudioManager {
  private ambientEnabled: boolean = false;
  private ambientCtx: AudioContext | null = null;
  private ambientTimer: number | null = null;
  private stepIdx: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        // Always start paused on fresh mount unless explicitly toggled during active user session
        this.ambientEnabled = false;
      } catch {}

      window.addEventListener('studentos-sound-pref-changed', (evt: Event) => {
        const detail = (evt as CustomEvent)?.detail;
        if (detail?.muted && this.ambientEnabled) {
          this.stopAmbient();
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && this.ambientEnabled) {
          this.stopAmbient();
        }
      });
    }
  }

  public isAmbientPlaying(): boolean {
    return this.ambientEnabled;
  }

  public toggleAmbient(): boolean {
    soundService.unlockFromUserGesture();
    if (this.ambientEnabled) {
      this.stopAmbient();
      return false;
    }
    return this.startAmbient();
  }

  public startAmbient(): boolean {
    if (typeof window === 'undefined') return false;
    const prefs = soundService.getPreferences();
    if (prefs.muted || prefs.volume <= 0.001) {
      return false;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;
      if (!this.ambientCtx || this.ambientCtx.state === 'closed') {
        this.ambientCtx = new AudioCtx();
      }
      if (this.ambientCtx.state === 'suspended') {
        this.ambientCtx.resume().catch(() => {});
      }
      this.ambientEnabled = true;
      try {
        localStorage.setItem(AMBIENT_STORAGE_KEY, 'true');
      } catch {}

      if (this.ambientTimer !== null) {
        window.clearInterval(this.ambientTimer);
      }
      // Schedule gentle celesta snowflake arpeggio notes every 1.4s
      const notes = [523.25, 622.25, 783.99, 932.33, 783.99, 698.46, 622.25, 587.33]; // C5 Eb5 G5 Bb5 G5 F5 Eb5 D5
      const playStep = () => {
        if (!this.ambientEnabled || !this.ambientCtx) return;
        const p = soundService.getPreferences();
        if (p.muted || p.volume <= 0.001) {
          this.stopAmbient();
          return;
        }
        const ctx = this.ambientCtx;
        const now = ctx.currentTime;
        const freq = notes[this.stepIdx % notes.length];
        this.stepIdx++;

        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const gain = ctx.createGain();
        const master = Math.min(0.08, p.volume * 0.065);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(master, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);

        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.18, now);

        osc.connect(gain);
        overtone.connect(subGain);
        subGain.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        overtone.start(now);
        osc.stop(now + 1.3);
        overtone.stop(now + 1.3);
      };

      playStep();
      this.ambientTimer = window.setInterval(playStep, 1350);
      return true;
    } catch {
      this.ambientEnabled = false;
      return false;
    }
  }

  public stopAmbient() {
    this.ambientEnabled = false;
    if (this.ambientTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    try {
      localStorage.setItem(AMBIENT_STORAGE_KEY, 'false');
    } catch {}
  }

  private playLocalCue(path: string, category: 'gameplay' | 'progression' | 'appear' | 'achievements') {
    if (typeof window === 'undefined') return;
    if (!soundService.isCategoryEnabled(category)) return;
    try {
      const prefs = soundService.getPreferences();
      const audio = new Audio(path);
      audio.volume = Math.max(0, Math.min(1, prefs.volume * 0.65));
      void audio.play().catch(() => {});
    } catch {}
  }

  public playFrostXpEarned() {
    soundService.unlockFromUserGesture();
    this.playLocalCue('/sounds/correct-answer.wav', 'gameplay');
  }

  public playPurchaseSuccess() {
    soundService.unlockFromUserGesture();
    this.playLocalCue('/sounds/level-up-08-402152.wav', 'progression');
  }

  public playBannerEquipped() {
    soundService.unlockFromUserGesture();
    this.playLocalCue('/sounds/transitions-appear-sound-effect-short-8367.wav', 'appear');
  }

  public playBorderEquipped() {
    soundService.unlockFromUserGesture();
    this.playLocalCue('/sounds/transitions-appear-sound-effect-short-8367.wav', 'appear');
  }

  public playBadgeEarned() {
    soundService.unlockFromUserGesture();
    this.playLocalCue('/sounds/achievement-unlocked-2-203875.wav', 'achievements');
  }

  public playCookieExchange() {
    soundService.unlockFromUserGesture();
    this.playLocalCue('/sounds/correct-answer.wav', 'gameplay');
  }
}

export const winterAudio = new WinterAudioManager();
