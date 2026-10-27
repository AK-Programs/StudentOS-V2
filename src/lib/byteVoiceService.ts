/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Client-Side Byte Voice Audio Engine
 * High-fidelity neural voice playback powered by Microsoft Edge TTS with:
 * - Natural Hindi (hi-IN-SwaraNeural, hi-IN-MadhurNeural) & Indian English (en-IN-NeerjaNeural, etc.)
 * - Automatic Mixed Hindi-English sentence handling
 * - Audio lifecycle management: Play, Pause, Resume, Stop, Replay, and Mute
 * - Active cancellation preventing overlapping speech or stale queues
 * - Graceful fallback to window.speechSynthesis when offline or during provider issues
 * - Persistent voice preferences per user
 */

export interface EdgeVoiceMeta {
  id: string;
  name: string;
  locale: string;
  gender: 'Female' | 'Male';
  displayName: string;
  language: 'hi' | 'en' | 'mixed';
  accent: string;
  recommendedRole: string;
  sampleText: string;
}

export type EdgeVoiceOption = EdgeVoiceMeta;

export interface ByteVoicePreferences {
  hindiVoiceId: string;
  englishVoiceId: string;
  speed: number;
  autoSpeak: boolean;
  preferredLanguage: 'en' | 'hi' | 'mixed';
  muted: boolean;
}

export type BytePlaybackState = 'idle' | 'loading' | 'speaking' | 'paused' | 'error';

const PREFS_STORAGE_KEY = 'studentos_byte_voice_prefs';

export const DEFAULT_VOICE_PREFERENCES: ByteVoicePreferences = {
  hindiVoiceId: 'hi-IN-SwaraNeural',
  englishVoiceId: 'en-IN-NeerjaNeural',
  speed: 1.0,
  autoSpeak: true,
  preferredLanguage: 'mixed',
  muted: false
};

class ByteVoiceService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private currentAbortController: AbortController | null = null;
  private lastSpokenText: string = '';
  private state: BytePlaybackState = 'idle';
  private cachedVoices: EdgeVoiceMeta[] = [];
  private isUsingFallback: boolean = false;
  private listeners: Set<(state: BytePlaybackState) => void> = new Set();
  private userUnlocked: boolean = false;

  private prefs: ByteVoicePreferences = { ...DEFAULT_VOICE_PREFERENCES };

  constructor() {
    this.loadPreferences();
    if (typeof window !== 'undefined') {
      const unlockGesture = () => {
        this.userUnlocked = true;
        window.removeEventListener('click', unlockGesture);
        window.removeEventListener('keydown', unlockGesture);
        window.removeEventListener('touchstart', unlockGesture);
      };
      window.addEventListener('click', unlockGesture, { passive: true });
      window.addEventListener('keydown', unlockGesture, { passive: true });
      window.addEventListener('touchstart', unlockGesture, { passive: true });
    }
  }

  public getPreferences(): ByteVoicePreferences {
    return { ...this.prefs };
  }

  public updatePreferences(partial: Partial<ByteVoicePreferences>) {
    this.prefs = { ...this.prefs, ...partial };
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(this.prefs));
    } catch (_) {}
  }

  private loadPreferences() {
    try {
      const stored = localStorage.getItem(PREFS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.prefs = { ...DEFAULT_VOICE_PREFERENCES, ...parsed };
      }
    } catch (_) {}
  }

  public getState(): BytePlaybackState {
    return this.state;
  }

  public isFallbackActive(): boolean {
    return this.isUsingFallback;
  }

  public subscribe(listener: (state: BytePlaybackState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(newState: BytePlaybackState) {
    this.state = newState;
    this.listeners.forEach(fn => fn(newState));
  }

  /**
   * Fetches verified Edge voices from server endpoint
   */
  public async getVoices(): Promise<EdgeVoiceMeta[]> {
    if (this.cachedVoices.length > 0) return this.cachedVoices;
    try {
      const res = await fetch('/api/tts/voices');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.voices)) {
          this.cachedVoices = data.voices;
          return this.cachedVoices;
        }
      }
    } catch (e) {
      console.warn('[ByteVoice] Failed to load remote voices catalog:', e);
    }
    return this.getDefaultVoices();
  }

  public async getAvailableVoices(): Promise<EdgeVoiceMeta[]> {
    return this.getVoices();
  }

  private getDefaultVoices(): EdgeVoiceMeta[] {

    // Default fallback catalog if network request is interrupted
    return [
      {
        id: 'hi-IN-SwaraNeural',
        name: 'Swara',
        locale: 'hi-IN',
        gender: 'Female',
        displayName: 'Swara · Hindi (Warm & Natural)',
        language: 'hi',
        accent: 'Indian Hindi',
        recommendedRole: 'Primary Hindi Teacher (Byte default)',
        sampleText: 'नमस्ते! मैं बाइट हूँ, आपकी पढ़ाई का साथी।'
      },
      {
        id: 'hi-IN-MadhurNeural',
        name: 'Madhur',
        locale: 'hi-IN',
        gender: 'Male',
        displayName: 'Madhur · Hindi (Clear & Engaging)',
        language: 'hi',
        accent: 'Indian Hindi',
        recommendedRole: 'Hindi Faculty Voice',
        sampleText: 'नमस्कार! विज्ञान और गणित के सवाल हम आसानी से समझ सकते हैं।'
      },
      {
        id: 'en-IN-NeerjaNeural',
        name: 'Neerja',
        locale: 'en-IN',
        gender: 'Female',
        displayName: 'Neerja · Indian English (Natural & Expressive)',
        language: 'en',
        accent: 'Indian English',
        recommendedRole: 'Primary English Teacher (Byte default)',
        sampleText: 'Hello! I am Byte, your StudentOS AI study companion.'
      },
      {
        id: 'en-IN-PrabhatNeural',
        name: 'Prabhat',
        locale: 'en-IN',
        gender: 'Male',
        displayName: 'Prabhat · Indian English',
        language: 'en',
        accent: 'Indian English',
        recommendedRole: 'Indian English Faculty Voice',
        sampleText: 'Welcome to class. Let us break down this problem step by step.'
      },
      {
        id: 'en-US-AriaNeural',
        name: 'Aria',
        locale: 'en-US',
        gender: 'Female',
        displayName: 'Aria · Global English',
        language: 'en',
        accent: 'Global English',
        recommendedRole: 'Global Academic English',
        sampleText: 'Welcome to StudentOS! Let us start learning.'
      }
    ];
  }

  /**
   * Immediately stops any currently playing audio and aborts in-flight requests.
   */
  public stop() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    this.setState('idle');
  }

  public pause() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.setState('paused');
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      this.setState('paused');
    }
  }

  public resume() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().then(() => {
        this.setState('speaking');
      }).catch(err => {
        console.warn('[ByteVoice] Audio resume prevented:', err);
      });
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.setState('speaking');
    }
  }

  /**
   * Main speech function.
   * Cancels any prior playback, fetches natural Edge TTS audio, and streams it cleanly.
   */
  public async speak(
    text: string,
    options?: {
      voiceId?: string;
      speed?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): Promise<boolean> {
    if (!text || !text.trim()) return false;
    if (this.prefs.muted) return false;

    // 1. Cancel previous playback immediately to prevent overlapping speech
    this.stop();

    this.lastSpokenText = text;
    this.isUsingFallback = false;
    this.setState('loading');

    const clean = text.trim();
    const speed = options?.speed || this.prefs.speed || 1.0;

    // Detect if text contains Hindi (Devanagari) characters
    const hasHindi = /[\u0900-\u097F]/.test(clean);
    const selectedVoiceId = options?.voiceId || (hasHindi ? this.prefs.hindiVoiceId : this.prefs.englishVoiceId);

    const controller = new AbortController();
    this.currentAbortController = controller;

    try {
      const response = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          voiceId: selectedVoiceId,
          hindiVoiceId: this.prefs.hindiVoiceId,
          englishVoiceId: this.prefs.englishVoiceId,
          speed,
          detectMixedLanguage: true
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Edge TTS returned status ${response.status}`);
      }

      const audioBlob = await response.blob();
      let dataUrl = '';
      if (typeof (window as any).blobToBase64 === 'function') {
        dataUrl = await (window as any).blobToBase64(audioBlob);
      } else {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
      }
      this.currentObjectUrl = dataUrl;

      const audio = new Audio(dataUrl);
      this.currentAudio = audio;
      audio.playbackRate = 1.0; // Speed already tuned by Edge TTS server

      return new Promise<boolean>((resolve) => {
        audio.onplay = () => {
          this.setState('speaking');
          if (options?.onStart) options.onStart();
        };

        audio.onended = () => {
          this.stop();
          if (options?.onEnd) options.onEnd();
          resolve(true);
        };

        audio.onerror = (e) => {
          console.warn('[ByteVoice] Audio element playback error, falling back:', e);
          this.fallbackSpeech(clean, speed, options?.onEnd);
          resolve(true);
        };

        audio.play().catch(playErr => {
          console.warn('[ByteVoice] Autoplay blocked or interaction required:', playErr);
          // If browser blocked unprompted autoplay, fallback to speech synthesis or wait for user touch
          this.fallbackSpeech(clean, speed, options?.onEnd);
          resolve(true);
        });
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return false;
      }
      console.warn('[ByteVoice] Remote Edge TTS failed, utilizing transparent local fallback:', err?.message || err);
      this.fallbackSpeech(clean, speed, options?.onEnd);
      if (options?.onError) options.onError(err);
      return true;
    }
  }

  /**
   * Transparent client-side fallback using window.speechSynthesis
   */
  private fallbackSpeech(text: string, speed: number, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.setState('idle');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      this.isUsingFallback = true;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.8, Math.min(1.3, speed));
      utterance.pitch = 1.0;

      // Select natural Indian or Hindi voice if available in browser
      const sysVoices = window.speechSynthesis.getVoices();
      const isHindi = /[\u0900-\u097F]/.test(text);
      const match = sysVoices.find(v => isHindi ? v.lang.startsWith('hi') : (v.lang === 'en-IN' || v.lang.startsWith('en')));
      if (match) utterance.voice = match;

      utterance.onstart = () => this.setState('speaking');
      utterance.onend = () => {
        this.setState('idle');
        if (onEnd) onEnd();
      };
      utterance.onerror = () => this.setState('idle');

      window.speechSynthesis.speak(utterance);
    } catch (_) {
      this.setState('idle');
    }
  }

  public replay(options?: { speed?: number; onEnd?: () => void }) {
    if (this.lastSpokenText) {
      this.speak(this.lastSpokenText, options);
    }
  }

  /**
   * Quick preview for testing a specific voice in Admin or Settings
   */
  public async previewVoice(voiceId: string, speed: number = 1.0): Promise<void> {
    const catalog = await this.getVoices();
    const voice = catalog.find(v => v.id === voiceId) || catalog[0];
    await this.speak(voice.sampleText, { voiceId, speed });
  }
}

export const byteVoiceService = new ByteVoiceService();
