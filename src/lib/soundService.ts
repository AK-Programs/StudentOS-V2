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

export interface SoundCategoryPreferences {
  ui: boolean;            // Button Click (Pixabay #289742)
  progression: boolean;   // Level Up (Pixabay #402152)
  chat: boolean;          // Message Ping (Pixabay #351298)
  notifications: boolean; // New Notification (Pixabay #7062)
  achievements: boolean;  // Achievement Unlocked (Pixabay #203875)
  gameplay: boolean;      // Correct Answer (Pixabay #6033)
  timer: boolean;         // Short Digital Alert (Pixabay #242596)
  appear: boolean;        // Appear Sound (Pixabay #8367)
}

export interface SoundPreferencesSnapshot {
  muted: boolean;
  flashcardSoundEnabled: boolean;
  volume: number; // 0.0 to 1.0
  categories: SoundCategoryPreferences;
}

export interface PixabaySoundMeta {
  id: string;
  name: string;
  category: keyof SoundCategoryPreferences;
  sourcePage: string;
  fileUrl: string;
  fallbackFileUrl: string;
  license: string;
  description: string;
  recommendedUse: string[];
}

export const PIXABAY_SOUND_CATALOG: Record<string, PixabaySoundMeta> = {
  buttonClick: {
    id: 'button-click-289742',
    name: 'Button Click',
    category: 'ui',
    sourcePage: 'https://pixabay.com/sound-effects/film-special-effects-button-click-289742/',
    fileUrl: '/sounds/button-click-289742.mp3',
    fallbackFileUrl: '/sounds/button-click.mp3',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    description: 'Subtle mechanical button click for primary action buttons, Quick Play, and key UI interactions.',
    recommendedUse: [
      'Primary action buttons',
      'Play Now and Quick Play buttons in Brain Battle',
      'Opening a game mode or starting a new activity',
      'Confirming a lightweight UI selection'
    ]
  },
  levelUp: {
    id: 'level-up-08-402152',
    name: 'Level Up',
    category: 'progression',
    sourcePage: 'https://pixabay.com/sound-effects/film-special-effects-level-up-08-402152/',
    fileUrl: '/sounds/level-up-08-402152.wav',
    fallbackFileUrl: '/sounds/level-up.wav',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    description: 'Triumphant ascending fanfare for verified student level increases and major XP milestones.',
    recommendedUse: [
      'Student level increases',
      'Successful level-up celebrations',
      'Major XP milestones triggering level change',
      'Brain Battle results when player level advances'
    ]
  },
  messagePing: {
    id: 'message-ping-351298',
    name: 'Message Ping',
    category: 'chat',
    sourcePage: 'https://pixabay.com/sound-effects/film-special-effects-message-ping-351298/',
    fileUrl: '/sounds/message-ping-351298.wav',
    fallbackFileUrl: '/sounds/message-ping.wav',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    description: 'Crystal sine chime for incoming direct messages, background chat, and floating notifications.',
    recommendedUse: [
      'New incoming direct messages',
      'New chat messages in background tabs/rooms',
      'Floating chat notification indicators'
    ]
  },
  newNotification: {
    id: 'notification-sound-7062',
    name: 'New Notification',
    category: 'notifications',
    sourcePage: 'https://pixabay.com/sound-effects/notification-sound-7062/',
    fileUrl: '/sounds/notification-sound-7062.mp3',
    fallbackFileUrl: '/sounds/notification-sound.mp3',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    description: 'Polished alert tone for urgent announcements, grade updates, and deadline reminders.',
    recommendedUse: [
      'System alerts and high-priority broadcasts',
      'Grade published updates',
      'Attendance warnings',
      'Assignment deadline reminders'
    ]
  },
  achievementUnlocked: {
    id: 'game-elements-achievement-unlocked-2-203875',
    name: 'Achievement Unlocked',
    category: 'achievements',
    sourcePage: 'https://pixabay.com/sound-effects/game-elements-achievement-unlocked-2-203875/',
    fileUrl: '/sounds/achievement-unlocked-2-203875.wav',
    fallbackFileUrl: '/sounds/achievement-unlocked.wav',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    description: 'Golden chord flourish for badge rewards, House cup point celebrations, and streak achievements.',
    recommendedUse: [
      'Badges earned in StudentOS Gamification Hub',
      'House cup points awarded',
      'Brain Battle achievements unlocked',
      'Major study streaks achieved'
    ]
  },
  correctAnswer: {
    id: 'game-elements-correct-6033',
    name: 'Correct Answer',
    category: 'gameplay',
    sourcePage: 'https://pixabay.com/sound-effects/game-elements-correct-6033/',
    fileUrl: '/sounds/game-elements-correct-6033.wav',
    fallbackFileUrl: '/sounds/correct-answer.wav',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    description: 'Crisp upbeat affirmative chime for correct questions in Brain Battle and interactive quizzes.',
    recommendedUse: [
      'Correct answers in Brain Battle',
      'Success state in flashcards and study checks',
      'Positive validation on practice questions'
    ]
  },
  shortDigitalAlert: {
    id: 'notification-sound-short-digital-notification-alert-242596',
    name: 'Short Digital Notification Alert',
    category: 'timer',
    sourcePage: 'https://pixabay.com/sound-effects/notification-sound-short-digital-notification-alert-242596/',
    fileUrl: '/sounds/notification-sound-short-digital-notification-alert-242596.wav',
    fallbackFileUrl: '/sounds/short-digital-alert.wav',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    description: 'Two crisp micro-pulses for Focus Timer transitions and non-critical system toasts.',
    recommendedUse: [
      'Focus Timer transitions (session start/complete, break start/end)',
      'Status updates and brief alerts',
      'Non-critical system confirmations',
      'Quick action completion toasts'
    ]
  },
  appearSound: {
    id: 'transitions-appear-sound-effect-short-8367',
    name: 'Appear Sound',
    category: 'appear',
    sourcePage: 'https://pixabay.com/sound-effects/transitions-appear-sound-effect-short-8367/',
    fileUrl: '/sounds/transitions-appear-sound-effect-short-8367.wav',
    fallbackFileUrl: '/sounds/appear-sound.wav',
    license: 'Pixabay Content License (Free for commercial/non-commercial use)',
    description: 'Smooth aerodynamic whoosh pop for modal dialogs, drawers, and card reveal animations.',
    recommendedUse: [
      'Modal dialogs opening',
      'Flyout panels and drawer opens',
      'Brain Battle match-found or opponent reveal',
      'New card appearing in a deck or feed'
    ]
  }
};

const STORAGE_KEY_MUTED = 'studentos_sound_muted';
const STORAGE_KEY_FLASHCARD_ENABLED = 'studentos_flashcard_sound_enabled';
const STORAGE_KEY_VOLUME = 'studentos_sound_volume';
const STORAGE_KEY_CATEGORIES = 'studentos_sound_categories';

interface ActiveAudioNodeEntry {
  osc: OscillatorNode;
  gain: GainNode;
}

class SoundService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private flashcardSoundEnabled: boolean = true;
  private volume: number = 0.75;
  private categories: SoundCategoryPreferences = {
    ui: true,
    progression: true,
    chat: true,
    notifications: true,
    achievements: true,
    gameplay: true,
    timer: true,
    appear: true
  };
  private audioElements: Map<string, HTMLAudioElement> = new Map();
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

      const savedCategories = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (savedCategories !== null) {
        try {
          const parsed = JSON.parse(savedCategories);
          if (parsed && typeof parsed === 'object') {
            this.categories = { ...this.categories, ...parsed };
          }
        } catch (_) {}
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
      volume: this.volume,
      categories: { ...this.categories }
    };
  }

  public setCategoryEnabled(cat: keyof SoundCategoryPreferences, enabled: boolean) {
    this.categories[cat] = enabled;
    try {
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(this.categories));
    } catch (_) {}
    this.emitPreferenceChange();
  }

  public isCategoryEnabled(cat: keyof SoundCategoryPreferences): boolean {
    return !this.isMuted && this.volume > 0.001 && Boolean(this.categories[cat]);
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

  public playBadgeCelebration() {
    this.playAchievementSound();
  }

  public playStreakFire() {
    this.playSuccessSound();
  }

  public playStreakShield() {
    this.playAchievementSound();
  }

  // ========================================================================
  // 8 OFFICIAL PIXABAY SOUND EFFECTS INTEGRATION (AUDIO + SYNTH DUAL-LAYER)
  // ========================================================================

  /**
   * Helper that attempts HTML5 Audio playback of the hosted sound asset,
   * falling back automatically to high-precision Web Audio synthesis if blocked by browser policy.
   */
  private playPixabayAsset(
    catalogKey: keyof typeof PIXABAY_SOUND_CATALOG,
    throttleMs: number,
    synthFallback: () => void
  ) {
    const meta = PIXABAY_SOUND_CATALOG[catalogKey];
    if (!meta) return;
    if (this.isMuted || this.volume <= 0.001) return;
    if (!this.categories[meta.category]) return;
    if (!this.shouldAllowPlay(`px_${meta.id}`, throttleMs)) return;

    if (typeof window === 'undefined') return;

    try {
      let audio = this.audioElements.get(meta.id);
      if (!audio) {
        audio = new Audio(meta.fileUrl);
        audio.preload = 'auto';
        this.audioElements.set(meta.id, audio);
      }

      audio.volume = Math.max(0, Math.min(1, this.volume));
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((_err) => {
          // Playback blocked or file missing: fallback to Web Audio synthesis!
          synthFallback();
        });
      }
    } catch (_) {
      synthFallback();
    }
  }

  /**
   * 1. Button Click
   * Source: https://pixabay.com/sound-effects/film-special-effects-button-click-289742/
   * Use for: Primary action buttons, Quick Play, mode selections, and key navigation.
   */
  public playButtonClick() {
    this.playPixabayAsset('buttonClick', 60, () => {
      this.playToggleSound(true);
    });
  }
  public playPixabayButtonClick() {
    this.playButtonClick();
  }

  /**
   * 2. Level Up
   * Source: https://pixabay.com/sound-effects/film-special-effects-level-up-08-402152/
   * Use for: Confirmed student level increases and major XP milestones.
   */
  public playLevelUp() {
    this.playPixabayAsset('levelUp', 300, () => {
      const ctx = this.getContext(false);
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((freq, idx) => {
          this.scheduleTone(ctx, {
            type: 'sine',
            startFreq: freq,
            startTime: now + idx * 0.08,
            duration: 0.35,
            peakGain: 0.1
          });
        });
      } catch (_) {}
    });
  }
  public playPixabayLevelUp() {
    this.playLevelUp();
  }

  /**
   * 3. Message Ping
   * Source: https://pixabay.com/sound-effects/film-special-effects-message-ping-351298/
   * Use for: Incoming direct messages, active chat rooms, floating indicators.
   */
  public playMessagePing() {
    this.playPixabayAsset('messagePing', 100, () => {
      const ctx = this.getContext(false);
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: 880,
          endFreq: 1320,
          startTime: now,
          duration: 0.22,
          peakGain: 0.09
        });
      } catch (_) {}
    });
  }
  public playPixabayMessagePing() {
    this.playMessagePing();
  }

  /**
   * 4. New Notification
   * Source: https://pixabay.com/sound-effects/notification-sound-7062/
   * Use for: System alerts, broadcasts, grade updates, and deadline reminders.
   */
  public playNewNotification() {
    this.playPixabayAsset('newNotification', 150, () => {
      const ctx = this.getContext(false);
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: 783.99,
          startTime: now,
          duration: 0.16,
          peakGain: 0.1
        });
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: 1046.5,
          startTime: now + 0.07,
          duration: 0.25,
          peakGain: 0.11
        });
      } catch (_) {}
    });
  }
  public playPixabayNewNotification() {
    this.playNewNotification();
  }

  /**
   * 5. Achievement Unlocked
   * Source: https://pixabay.com/sound-effects/game-elements-achievement-unlocked-2-203875/
   * Use for: Badges earned, House Cup points awarded, and streak milestones.
   */
  public playAchievementUnlocked() {
    this.playPixabayAsset('achievementUnlocked', 250, () => {
      const ctx = this.getContext(false);
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const notes = [587.33, 739.99, 880.0, 1174.66];
        notes.forEach((freq, idx) => {
          this.scheduleTone(ctx, {
            type: 'sine',
            startFreq: freq,
            startTime: now + idx * 0.07,
            duration: 0.28,
            peakGain: 0.095
          });
        });
      } catch (_) {}
    });
  }
  public playPixabayAchievementUnlocked() {
    this.playAchievementUnlocked();
  }

  /**
   * 6. Correct Answer
   * Source: https://pixabay.com/sound-effects/game-elements-correct-6033/
   * Use for: Correct question answers in Brain Battle and interactive study checks.
   */
  public playCorrectAnswer() {
    this.playPixabayAsset('correctAnswer', 80, () => {
      const ctx = this.getContext(false);
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: 783.99,
          startTime: now,
          duration: 0.14,
          peakGain: 0.09
        });
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: 1046.50,
          startTime: now + 0.065,
          duration: 0.22,
          peakGain: 0.1
        });
      } catch (_) {}
    });
  }
  public playPixabayCorrectAnswer() {
    this.playCorrectAnswer();
  }

  /**
   * 7. Short Digital Notification Alert
   * Source: https://pixabay.com/sound-effects/notification-sound-short-digital-notification-alert-242596/
   * Use for: Focus Timer transitions (session start/complete, break start/end) and toasts.
   */
  public playShortDigitalAlert() {
    this.playPixabayAsset('shortDigitalAlert', 100, () => {
      const ctx = this.getContext(false);
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        this.scheduleTone(ctx, {
          type: 'triangle',
          startFreq: 1040,
          startTime: now,
          duration: 0.045,
          peakGain: 0.08
        });
        this.scheduleTone(ctx, {
          type: 'triangle',
          startFreq: 1040,
          startTime: now + 0.06,
          duration: 0.06,
          peakGain: 0.09
        });
      } catch (_) {}
    });
  }
  public playPixabayTimerAlert() {
    this.playShortDigitalAlert();
  }

  /**
   * 8. Appear Sound
   * Source: https://pixabay.com/sound-effects/transitions-appear-sound-effect-short-8367/
   * Use for: Modal dialogs opening, flyout panels, drawer opens, and card reveals.
   */
  public playAppearSound() {
    this.playPixabayAsset('appearSound', 70, () => {
      const ctx = this.getContext(false);
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        this.scheduleTone(ctx, {
          type: 'sine',
          startFreq: 320,
          endFreq: 680,
          startTime: now,
          duration: 0.14,
          peakGain: 0.075
        });
      } catch (_) {}
    });
  }
  public playPixabayAppearSound() {
    this.playAppearSound();
  }

  /**
   * Interactive test function to preview any of the 8 Pixabay sounds in settings
   */
  public testSound(soundKey: string) {
    this.unlockFromUserGesture();
    switch (soundKey) {
      case 'buttonClick':
      case 'button-click-289742':
        this.playButtonClick();
        break;
      case 'levelUp':
      case 'level-up-08-402152':
        this.playLevelUp();
        break;
      case 'messagePing':
      case 'message-ping-351298':
        this.playMessagePing();
        break;
      case 'newNotification':
      case 'notification-sound-7062':
        this.playNewNotification();
        break;
      case 'achievementUnlocked':
      case 'game-elements-achievement-unlocked-2-203875':
        this.playAchievementUnlocked();
        break;
      case 'correctAnswer':
      case 'game-elements-correct-6033':
        this.playCorrectAnswer();
        break;
      case 'shortDigitalAlert':
      case 'notification-sound-short-digital-notification-alert-242596':
        this.playShortDigitalAlert();
        break;
      case 'appearSound':
      case 'transitions-appear-sound-effect-short-8367':
        this.playAppearSound();
        break;
      default:
        this.playButtonClick();
        break;
    }
  }
}

export const soundService = new SoundService();
