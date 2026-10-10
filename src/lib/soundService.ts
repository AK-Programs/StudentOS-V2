/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Web Audio API Sound Synthesizer for StudentOS
 * Provides subtle, high-quality, non-distracting audio feedback using pure Web Audio synthesis
 * with zero external audio service dependencies.
 *
 * Features:
 * - Respects StudentOS global mute, Flashcard-specific sound toggle, and master volume (0.0 - 1.0)
 * - Respects browser autoplay restrictions (never plays on page load; requires user gesture)
 * - Respects device mute switch (via Web Audio API ambient playback category on mobile/PWA)
 * - Respects prefers-reduced-motion accessibility preferences (softer envelope)
 * - Prevents overlapping flashcard sounds, debounces rapid repeated events, and cleans up all nodes
 */

export interface SoundPreferencesSnapshot {
  muted: boolean;
  flashcardSoundEnabled: boolean;
  volume: number; // 0.0 to 1.0
}

const STORAGE_KEY_MUTED = 'studentos_sound_muted';
const STORAGE_KEY_FLASHCARD_ENABLED = 'studentos_flashcard_sound_enabled';
const STORAGE_KEY_VOLUME = 'studentos_sound_volume';

interface ActiveAudioNodeEntry {
  osc: OscillatorNode;
  gain: GainNode;
}

class SoundService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private flashcardSoundEnabled: boolean = true;
  private volume: number = 0.75;
  private hasUserInteracted: boolean = false;
  private reducedMotionQuery: MediaQueryList | null = null;
  private lastPlayedAt: Map<string, number> = new Map();
  private activeFlashcardNodes: Set<ActiveAudioNodeEntry> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadPreferencesFromStorage();

      try {
        if (typeof window.matchMedia === 'function') {
          this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        }
      } catch (_) {}

      const markInteraction = () => {
        this.hasUserInteracted = true;
      };
      window.addEventListener('pointerdown', markInteraction, { passive: true });
      window.addEventListener('keydown', markInteraction, { passive: true });
      window.addEventListener('touchstart', markInteraction, { passive: true });
    }
  }

  private loadPreferencesFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const savedMute = localStorage.getItem(STORAGE_KEY_MUTED);
      if (savedMute !== null) {
        this.isMuted = Boolean(JSON.parse(savedMute));
      }

      const savedFlashcard = localStorage.getItem(STORAGE_KEY_FLASHCARD_ENABLED);
      if (savedFlashcard !== null) {
        this.flashcardSoundEnabled = Boolean(JSON.parse(savedFlashcard));
      }

      const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (savedVolume !== null) {
        const parsedVol = Number(JSON.parse(savedVolume));
        if (Number.isFinite(parsedVol)) {
          this.volume = Math.max(0, Math.min(1, parsedVol));
        }
      }

      // Also inspect cached StudentOS user profile if present
      const rawUser = localStorage.getItem('s_os_user');
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser);
        const rawData = parsedUser?.raw_data;
        if (rawData && typeof rawData === 'object') {
          if (savedMute === null && typeof rawData.notifyChat === 'boolean') {
            this.isMuted = !rawData.notifyChat;
          }
          if (savedFlashcard === null && typeof rawData.flashcardSoundEnabled === 'boolean') {
            this.flashcardSoundEnabled = rawData.flashcardSoundEnabled;
          }
          if (savedVolume === null && typeof rawData.soundVolume === 'number') {
            this.volume = Math.max(0, Math.min(1, rawData.soundVolume));
          }
        }
      }
    } catch (_) {}
  }

  private emitPreferenceChange() {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent<SoundPreferencesSnapshot>('studentos-sound-pref-changed', {
          detail: this.getPreferences()
        })
      );
    } catch (_) {}
  }

  /**
   * Synchronize in-memory and localStorage sound preferences with a loaded StudentOS UserProfile
   */
  public syncWithUserProfile(user?: { raw_data?: Record<string, any> } | null) {
    if (!user?.raw_data || typeof window === 'undefined') return;
    let changed = false;
    const raw = user.raw_data;

    if (typeof raw.flashcardSoundEnabled === 'boolean' && localStorage.getItem(STORAGE_KEY_FLASHCARD_ENABLED) === null) {
      this.flashcardSoundEnabled = raw.flashcardSoundEnabled;
      try {
        localStorage.setItem(STORAGE_KEY_FLASHCARD_ENABLED, JSON.stringify(this.flashcardSoundEnabled));
      } catch (_) {}
      changed = true;
    }

    if (typeof raw.soundVolume === 'number' && localStorage.getItem(STORAGE_KEY_VOLUME) === null) {
      this.volume = Math.max(0, Math.min(1, raw.soundVolume));
      try {
        localStorage.setItem(STORAGE_KEY_VOLUME, JSON.stringify(this.volume));
      } catch (_) {}
      changed = true;
    }

    if (changed) {
      this.emitPreferenceChange();
    }
  }

  public getPreferences(): SoundPreferencesSnapshot {
    return {
      muted: this.isMuted,
      flashcardSoundEnabled: this.flashcardSoundEnabled,
      volume: this.volume
    };
  }

  public prefersReducedMotion(): boolean {
    return Boolean(this.reducedMotionQuery?.matches);
  }

  /**
   * Call inside explicit click/keyboard/touch handlers to ensure mobile/PWA AudioContext is unlocked
   */
  public unlockFromUserGesture() {
    this.hasUserInteracted = true;
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private getContext(requireFlashcardEnabled: boolean = false): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.isMuted || this.volume <= 0.001) return null;
    if (requireFlashcardEnabled && !this.flashcardSoundEnabled) return null;

    // Do not play sounds when page/PWA is hidden in background
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return null;
    }

    // Respect browser autoplay policies: never start AudioContext before user interaction
    const userAct = (navigator as any).userActivation;
    if (!this.hasUserInteracted && (!userAct || !userAct.hasBeenActive)) {
      return null;
    }

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return null;
      try {
        this.audioCtx = new AudioCtxClass();
      } catch (_) {
        return null;
      }
    }

    if (this.audioCtx && (this.audioCtx.state === 'suspended' || (this.audioCtx.state as string) === 'interrupted')) {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  /**
   * Returns true if enough time has elapsed since `key` was last played.
   * Prevents duplicate audio from React double-invocations or keyboard auto-repeat.
   */
  private shouldAllowPlay(key: string, minIntervalMs: number = 65): boolean {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prev = this.lastPlayedAt.get(key) || 0;
    if (now - prev < minIntervalMs) {
      return false;
    }
    this.lastPlayedAt.set(key, now);
    return true;
  }

  /**
   * Smoothly stops any currently ringing flashcard oscillators so consecutive actions never overlap harshly.
   */
  private clearActiveFlashcardNodes(ctx: AudioContext) {
    if (this.activeFlashcardNodes.size === 0) return;
    const now = ctx.currentTime;
    this.activeFlashcardNodes.forEach(entry => {
      try {
        entry.gain.gain.cancelScheduledValues(now);
        entry.gain.gain.setValueAtTime(Math.max(0.0001, entry.gain.gain.value || 0.01), now);
        entry.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
        entry.osc.stop(now + 0.018);
      } catch (_) {}
    });
    this.activeFlashcardNodes.clear();
  }

  /**
   * Helper to schedule a clean, leak-free Web Audio tone.
   */
  private scheduleTone(
    ctx: AudioContext,
    options: {
      type: OscillatorType;
      startFreq: number;
      endFreq?: number;
      startTime: number;
      duration: number;
      peakGain: number;
      trackAsFlashcard?: boolean;
    }
  ) {
    const {
      type,
      startFreq,
      endFreq,
      startTime,
      duration,
      peakGain,
      trackAsFlashcard = false
    } = options;

    const reducedMotionFactor = this.prefersReducedMotion() ? 0.75 : 1.0;
    const effectiveGain = Math.max(0.0005, Math.min(0.25, peakGain * this.volume * reducedMotionFactor));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq && endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration * 0.85);
    }

    // Soft envelope with micro-attack to avoid any click/pop artifact
    const attack = Math.min(0.012, duration * 0.2);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(effectiveGain, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    const entry: ActiveAudioNodeEntry = { osc, gain };
    if (trackAsFlashcard) {
      this.activeFlashcardNodes.add(entry);
    }

    osc.onended = () => {
      if (trackAsFlashcard) {
        this.activeFlashcardNodes.delete(entry);
      }
      try {
        osc.disconnect();
      } catch (_) {}
      try {
        gain.disconnect();
      } catch (_) {}
    };

    osc.start(startTime);
    osc.stop(startTime + duration + 0.005);
  }

  // ==========================================
  // PREFERENCE GETTERS & SETTERS
  // ==========================================

  public setMuted(muted: boolean) {
    this.isMuted = Boolean(muted);
    try {
      localStorage.setItem(STORAGE_KEY_MUTED, JSON.stringify(this.isMuted));
    } catch (_) {}
    this.emitPreferenceChange();
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public isEnabled(): boolean {
    return !this.isMuted;
  }

  public setEnabled(enabled: boolean) {
    this.setMuted(!enabled);
  }

  public isFlashcardSoundEnabled(): boolean {
    return !this.isMuted && this.flashcardSoundEnabled;
  }

  public getFlashcardSoundPreference(): boolean {
    return this.flashcardSoundEnabled;
  }

  public setFlashcardSoundEnabled(enabled: boolean) {
    this.flashcardSoundEnabled = Boolean(enabled);
    if (this.flashcardSoundEnabled && this.isMuted) {
      // If user explicitly turns on Flashcard Sound Effects while globally muted, unmute so it works intuitively
      this.isMuted = false;
      try {
        localStorage.setItem(STORAGE_KEY_MUTED, JSON.stringify(false));
      } catch (_) {}
    }
    try {
      localStorage.setItem(STORAGE_KEY_FLASHCARD_ENABLED, JSON.stringify(this.flashcardSoundEnabled));
    } catch (_) {}
    this.emitPreferenceChange();
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(nextVolume: number) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(nextVolume) ? nextVolume : 0.75));
    this.volume = clamped;
    try {
      localStorage.setItem(STORAGE_KEY_VOLUME, JSON.stringify(this.volume));
    } catch (_) {}
    this.emitPreferenceChange();
  }

  public toggleMute(): boolean {
    const nextMuted = !this.isMuted;
    this.setMuted(nextMuted);
    if (!nextMuted) {
      this.hasUserInteracted = true;
      this.playToggleSound(true);
    }
    return this.isMuted;
  }

  // ==========================================
  // STUDY FLASHCARDS DEDICATED SOUND EFFECTS
  // ==========================================

  /**
   * 1. Reveal Answer: Warm, soft ascending fifth (F4 -> C5) that feels like flipping a crisp study card.
   */
  public playFlashcardReveal() {
    this.unlockFromUserGesture();
    if (!this.shouldAllowPlay('fc_reveal', 65)) return;
    const ctx = this.getContext(true);
    if (!ctx) return;

    try {
      this.clearActiveFlashcardNodes(ctx);
      const now = ctx.currentTime;
      this.scheduleTone(ctx, {
        type: 'sine',
        startFreq: 349.23, // F4
        endFreq: 523.25,   // C5
        startTime: now,
        duration: 0.095,
        peakGain: 0.075,
        trackAsFlashcard: true
      });
    } catch (_) {}
  }

  /**
   * Hide Answer: Subtle, soft tuck tone (C5 -> F4) when collapsing the revealed answer.
   */
  public playFlashcardHide() {
    this.unlockFromUserGesture();
    if (!this.shouldAllowPlay('fc_hide', 65)) return;
    const ctx = this.getContext(true);
    if (!ctx) return;

    try {
      this.clearActiveFlashcardNodes(ctx);
      const now = ctx.currentTime;
      this.scheduleTone(ctx, {
        type: 'sine',
        startFreq: 466.16, // Bb4
        endFreq: 349.23,   // F4
        startTime: now,
        duration: 0.075,
        peakGain: 0.055,
        trackAsFlashcard: true
      });
    } catch (_) {}
  }

  /**
   * 2. Know It / Good / Easy: Pleasant, uplifting two-note harmonic chime (C5 -> G5, or C5 -> E5 -> A5 for Easy).
   */
  public playFlashcardKnowIt(quality: number = 4) {
    this.unlockFromUserGesture();
    if (!this.shouldAllowPlay('fc_rate', 90)) return;
    const ctx = this.getContext(true);
    if (!ctx) return;

    try {
      this.clearActiveFlashcardNodes(ctx);
      const now = ctx.currentTime;
      const notes = quality >= 5 ? [523.25, 659.25, 880.0] : [523.25, 783.99]; // C5 -> G5
      notes.forEach((freq, idx) => {
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: freq,
          startTime: now + idx * 0.055,
          duration: 0.14,
          peakGain: 0.085,
          trackAsFlashcard: true
        });
      });
    } catch (_) {}
  }

  /**
   * 3. Still Learning / Again / Hard: Calm, supportive, non-punitive warm interval (G4 -> D5).
   * Never uses harsh buzzers or descending error tones.
   */
  public playFlashcardStillLearning() {
    this.unlockFromUserGesture();
    if (!this.shouldAllowPlay('fc_rate', 90)) return;
    const ctx = this.getContext(true);
    if (!ctx) return;

    try {
      this.clearActiveFlashcardNodes(ctx);
      const now = ctx.currentTime;
      const notes = [392.0, 493.88]; // G4 -> B4 gentle reflective interval
      notes.forEach((freq, idx) => {
        this.scheduleTone(ctx, {
          type: 'triangle',
          startFreq: freq,
          startTime: now + idx * 0.055,
          duration: 0.12,
          peakGain: 0.065,
          trackAsFlashcard: true
        });
      });
    } catch (_) {}
  }

  /**
   * 4. Navigation (Previous, Next, Skip, Hint): Ultra-short, soft tactile page step.
   */
  public playFlashcardNavigate(direction: 'next' | 'prev' | 'hint' = 'next') {
    this.unlockFromUserGesture();
    if (!this.shouldAllowPlay(`fc_nav_${direction}`, 55)) return;
    const ctx = this.getContext(true);
    if (!ctx) return;

    try {
      this.clearActiveFlashcardNodes(ctx);
      const now = ctx.currentTime;
      if (direction === 'hint') {
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: 587.33, // D5
          endFreq: 659.25,   // E5
          startTime: now,
          duration: 0.07,
          peakGain: 0.055,
          trackAsFlashcard: true
        });
      } else {
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: direction === 'next' ? 440 : 520,
          endFreq: direction === 'next' ? 540 : 420,
          startTime: now,
          duration: 0.05,
          peakGain: 0.05,
          trackAsFlashcard: true
        });
      }
    } catch (_) {}
  }

  /**
   * 5. Shuffle / Restart Deck: Light 3-tap card riffle cascade.
   */
  public playFlashcardShuffle() {
    this.unlockFromUserGesture();
    if (!this.shouldAllowPlay('fc_shuffle', 150)) return;
    const ctx = this.getContext(true);
    if (!ctx) return;

    try {
      this.clearActiveFlashcardNodes(ctx);
      const now = ctx.currentTime;
      const notes = [440.0, 554.37, 659.25]; // A4, C#5, E5
      notes.forEach((freq, idx) => {
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: freq,
          startTime: now + idx * 0.032,
          duration: 0.06,
          peakGain: 0.06,
          trackAsFlashcard: true
        });
      });
    } catch (_) {}
  }

  /**
   * 6. Session Completion: Restrained, rewarding major arpeggio (C5 -> E5 -> G5 -> C6).
   */
  public playFlashcardSessionComplete() {
    this.unlockFromUserGesture();
    if (!this.shouldAllowPlay('fc_complete', 350)) return;
    const ctx = this.getContext(true);
    if (!ctx) return;

    try {
      this.clearActiveFlashcardNodes(ctx);
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        this.scheduleTone(ctx, {
          type: 'triangle',
          startFreq: freq,
          startTime: now + idx * 0.058,
          duration: 0.22,
          peakGain: 0.085,
          trackAsFlashcard: true
        });
      });
    } catch (_) {}
  }

  // Legacy alias used elsewhere in the app
  public playFlashcardCompleteSound() {
    this.playFlashcardSessionComplete();
  }

  // ==========================================
  // GENERAL STUDENTOS UI & NOTIFICATION SOUNDS
  // ==========================================

  public playClick() {
    this.playToggleSound(true);
  }

  public playToggle(turnedOn = true) {
    this.playToggleSound(turnedOn);
  }

  public playSuccess() {
    this.playSuccessSound();
  }

  public playTaskComplete() {
    this.playTaskCompleteSound();
  }

  public playAchievement() {
    this.playAchievementSound();
  }

  public playTimerAlarm() {
    this.playAnnouncementSound();
  }

  /**
   * Subtle tactile micro-click when toggling switches or important settings
   */
  public playToggleSound(turnedOn = true) {
    this.unlockFromUserGesture();
    if (!this.shouldAllowPlay('ui_toggle', 45)) return;
    const ctx = this.getContext(false);
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.scheduleTone(ctx, {
        type: 'sine',
        startFreq: turnedOn ? 520 : 420,
        endFreq: turnedOn ? 740 : 320,
        startTime: now,
        duration: 0.055,
        peakGain: 0.06
      });
    } catch (_) {}
  }

  /**
   * Play a clean, subtle message ping
   */
  public playMessageSound() {
    if (!this.shouldAllowPlay('ui_msg', 120)) return;
    const ctx = this.getContext(false);
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.scheduleTone(ctx, {
        type: 'sine',
        startFreq: 587.33,
        endFreq: 880,
        startTime: now,
        duration: 0.2,
        peakGain: 0.09
      });
    } catch (_) {}
  }

  /**
   * Play a distinct double chime for @mentions
   */
  public playMentionSound() {
    if (!this.shouldAllowPlay('ui_mention', 180)) return;
    const ctx = this.getContext(false);
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.scheduleTone(ctx, {
        type: 'triangle',
        startFreq: 659.25,
        startTime: now,
        duration: 0.13,
        peakGain: 0.1
      });
      this.scheduleTone(ctx, {
        type: 'sine',
        startFreq: 987.77,
        startTime: now + 0.08,
        duration: 0.22,
        peakGain: 0.11
      });
    } catch (_) {}
  }

  /**
   * Play an urgent flourish for school-wide announcements
   */
  public playAnnouncementSound() {
    if (!this.shouldAllowPlay('ui_announce', 300)) return;
    const ctx = this.getContext(false);
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: freq,
          startTime: now + idx * 0.07,
          duration: 0.22,
          peakGain: 0.1
        });
      });
    } catch (_) {}
  }

  /**
   * Play a cheerful success chime for homework & assignments
   */
  public playHomeworkSound() {
    if (!this.shouldAllowPlay('ui_hw', 150)) return;
    const ctx = this.getContext(false);
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.scheduleTone(ctx, {
        type: 'sine',
        startFreq: 440,
        endFreq: 880,
        startTime: now,
        duration: 0.24,
        peakGain: 0.09
      });
    } catch (_) {}
  }

  /**
   * Subtle two-note confirmation chime for successful actions (save, submit, confirm)
   */
  public playSuccessSound() {
    if (!this.shouldAllowPlay('ui_success', 120)) return;
    const ctx = this.getContext(false);
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 783.99];
      notes.forEach((freq, idx) => {
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: freq,
          startTime: now + idx * 0.065,
          duration: 0.16,
          peakGain: 0.085
        });
      });
    } catch (_) {}
  }

  /**
   * Gentle harmonic chime when completing a task or study milestone
   */
  public playTaskCompleteSound() {
    if (!this.shouldAllowPlay('ui_task', 120)) return;
    const ctx = this.getContext(false);
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [659.25, 987.77];
      notes.forEach((freq, idx) => {
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: freq,
          startTime: now + idx * 0.055,
          duration: 0.15,
          peakGain: 0.085
        });
      });
    } catch (_) {}
  }

  private ringtoneInterval: any = null;

  public playRingtone(type: 'incoming' | 'outgoing' = 'incoming') {
    this.stopRingtone();
    const ctx = this.getContext(false);
    if (!ctx) return;

    const playPulse = () => {
      try {
        const now = ctx.currentTime;
        this.scheduleTone(ctx, {
          type: type === 'incoming' ? 'sine' : 'triangle',
          startFreq: type === 'incoming' ? 880 : 440,
          startTime: now,
          duration: 0.38,
          peakGain: 0.08
        });
      } catch (_) {}
    };

    playPulse();
    this.ringtoneInterval = setInterval(playPulse, 1200);
  }

  public stopRingtone() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  /**
   * Warm chord flourish for House points, competition registration, or achievement badges
   */
  public playAchievementSound() {
    if (!this.shouldAllowPlay('ui_achieve', 250)) return;
    const ctx = this.getContext(false);
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [587.33, 739.99, 880.0, 1174.66];
      notes.forEach((freq, idx) => {
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: freq,
          startTime: now + idx * 0.06,
          duration: 0.25,
          peakGain: 0.09
        });
      });
    } catch (_) {}
  }
}

export const soundService = new SoundService();
