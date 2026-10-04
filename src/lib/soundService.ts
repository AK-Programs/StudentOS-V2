/**
 * Web Audio API Sound Synthesizer for StudentOS
 * Provides subtle, tasteful audio feedback without external asset dependencies.
 * Strictly respects user sound preference (Sound Effects: ON/OFF) and mobile autoplay policies.
 */

class SoundService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private hasUserInteracted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedMute = localStorage.getItem('studentos_sound_muted');
        if (savedMute !== null) {
          this.isMuted = JSON.parse(savedMute);
        }
      } catch (_) {}

      const markInteraction = () => {
        this.hasUserInteracted = true;
      };
      window.addEventListener('pointerdown', markInteraction, { once: true, passive: true });
      window.addEventListener('keydown', markInteraction, { once: true, passive: true });
    }
  }

  private getContext(): AudioContext | null {
    if (this.isMuted || typeof window === 'undefined') return null;

    // Respect mobile & PWA browser autoplay policies
    const userAct = (navigator as any).userActivation;
    if (userAct && !userAct.hasBeenActive && !this.hasUserInteracted) {
      return null;
    }

    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        try {
          this.audioCtx = new AudioCtxClass();
        } catch (_) {
          return null;
        }
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = Boolean(muted);
    try {
      localStorage.setItem('studentos_sound_muted', JSON.stringify(this.isMuted));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studentos-sound-pref-changed', { detail: { muted: this.isMuted } }));
      }
    } catch (_) {}
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

  public toggleMute(): boolean {
    const nextMuted = !this.isMuted;
    this.setMuted(nextMuted);
    if (!nextMuted) {
      this.hasUserInteracted = true;
      this.playToggleSound(true);
    }
    return this.isMuted;
  }

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
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(turnedOn ? 520 : 420, now);
      osc.frequency.exponentialRampToValueAtTime(turnedOn ? 740 : 320, now + 0.045);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (_) {}
  }

  /**
   * Play a clean, subtle message ping
   */
  public playMessageSound() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch (_) {}
  }

  /**
   * Play a distinct double chime for @mentions
   */
  public playMentionSound() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.14);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.08); // B5
      gain2.gain.setValueAtTime(0.14, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.32);
    } catch (_) {}
  }

  /**
   * Play an urgent flourish for school-wide announcements
   */
  public playAnnouncementSound() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0.11, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.24);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.24);
      });
    } catch (_) {}
  }

  /**
   * Play a cheerful success chime for homework & assignments
   */
  public playHomeworkSound() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    } catch (_) {}
  }

  /**
   * Subtle two-note confirmation chime for successful actions (save, submit, confirm)
   */
  public playSuccessSound() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 783.99]; // C5 -> G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.065);
        gain.gain.setValueAtTime(0.09, now + idx * 0.065);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.065);
        osc.stop(now + idx * 0.065 + 0.18);
      });
    } catch (_) {}
  }

  /**
   * Gentle harmonic chime when completing a task or study milestone
   */
  public playTaskCompleteSound() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [659.25, 987.77]; // E5 -> B5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.055);
        gain.gain.setValueAtTime(0.09, now + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.055);
        osc.stop(now + idx * 0.055 + 0.16);
      });
    } catch (_) {}
  }

  /**
   * Uplifting arpeggio when completing a flashcard deck or rating mastery
   */
  public playFlashcardCompleteSound() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 -> E5 -> G5 -> C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.055);
        gain.gain.setValueAtTime(0.09, now + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.055);
        osc.stop(now + idx * 0.055 + 0.22);
      });
    } catch (_) {}
  }

  /**
   * Warm chord flourish for House points, competition registration, or achievement badges
   */
  public playAchievementSound() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [587.33, 739.99, 880.0, 1174.66]; // D5 major triad + D6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.10, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.28);
      });
    } catch (_) {}
  }
}

export const soundService = new SoundService();
