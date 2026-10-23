/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Microsoft Edge TTS Server Integration
 * High-performance, natural neural voice synthesis for Hindi, Indian English, and Global English.
 * 
 * Features:
 * - Verified Microsoft Edge Neural Voices (hi-IN-SwaraNeural, hi-IN-MadhurNeural, en-IN-NeerjaNeural, etc.)
 * - Mixed Hindi-English (Hinglish) sentence detection & segment synthesis
 * - Mathematical formula, symbol, and abbreviation spoken-text translation
 * - Concurrency mutex & connection queue preventing Edge Gateway 429 rate-limits
 * - In-memory LRU audio cache for instant sub-millisecond retrieval of common phrases
 * - Safe sanitization preventing speech synthesis of raw JSON, markdown, or code
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import crypto from 'crypto';

export interface EdgeVoiceInfo {
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

export const VERIFIED_EDGE_VOICES: EdgeVoiceInfo[] = [
  {
    id: 'hi-IN-SwaraNeural',
    name: 'Swara',
    locale: 'hi-IN',
    gender: 'Female',
    displayName: 'Swara · Hindi (Warm & Natural)',
    language: 'hi',
    accent: 'Indian Hindi',
    recommendedRole: 'Primary Hindi Teacher (Byte default)',
    sampleText: 'नमस्ते! मैं बाइट हूँ, आपकी पढ़ाई का साथी। आज हम क्या नया सीखेंगे?'
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
    sampleText: 'नमस्कार! विज्ञान और गणित के किसी भी सवाल को हम आसानी से समझ सकते हैं।'
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
    sampleText: 'Hello! I am Byte, your StudentOS AI study companion. Let us explore this concept together!'
  },
  {
    id: 'en-IN-NeerjaExpressiveNeural',
    name: 'Neerja Expressive',
    locale: 'en-IN',
    gender: 'Female',
    displayName: 'Neerja Expressive · Indian English',
    language: 'en',
    accent: 'Indian English (Expressive)',
    recommendedRole: 'Conversational English',
    sampleText: 'Great effort! You are making steady progress on your daily learning missions.'
  },
  {
    id: 'en-IN-PrabhatNeural',
    name: 'Prabhat',
    locale: 'en-IN',
    gender: 'Male',
    displayName: 'Prabhat · Indian English (Clear & Articulate)',
    language: 'en',
    accent: 'Indian English',
    recommendedRole: 'Indian English Faculty Voice',
    sampleText: 'Welcome to class. Let us break down this problem into simple, step-by-step methods.'
  },
  {
    id: 'en-US-AriaNeural',
    name: 'Aria',
    locale: 'en-US',
    gender: 'Female',
    displayName: 'Aria · Global English (Crisp & Engaging)',
    language: 'en',
    accent: 'Global English',
    recommendedRole: 'Global Academic English',
    sampleText: 'Welcome to StudentOS! Every challenge you solve builds stronger neural pathways.'
  },
  {
    id: 'en-US-GuyNeural',
    name: 'Guy',
    locale: 'en-US',
    gender: 'Male',
    displayName: 'Guy · Global English (Calm & Focused)',
    language: 'en',
    accent: 'Global English',
    recommendedRole: 'Focused Lecture Voice',
    sampleText: 'Ready to study? Let us begin with the core concept and work through a clear example.'
  }
];

export interface SynthesizeOptions {
  text: string;
  voiceId?: string;
  hindiVoiceId?: string;
  englishVoiceId?: string;
  speed?: number; // 0.8 to 1.5
  pitch?: string; // e.g. "+0Hz"
  detectMixedLanguage?: boolean;
}

export interface SynthesizeResult {
  audioBuffer: Buffer;
  contentType: string;
  voiceId: string;
  durationMs: number;
  cached: boolean;
  charCount: number;
}

// In-Memory LRU Audio Cache
interface CacheEntry {
  buffer: Buffer;
  contentType: string;
  durationMs: number;
  createdAt: number;
}

const MAX_CACHE_SIZE = 250;
const audioCache = new Map<string, CacheEntry>();

function getCacheKey(text: string, voiceId: string, speed: number): string {
  return crypto.createHash('sha256').update(`${voiceId}:${speed.toFixed(2)}:${text.trim()}`).digest('hex');
}

/**
 * Preprocesses raw lesson text into smooth, speakable text:
 * - Translates common mathematical expressions into spoken English or Hindi
 * - Converts chemical formulas (H2O, CO2) into spoken notation
 * - Strips raw JSON, markdown table formatting, asterisks, brackets, and code tags
 */
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';

  let text = String(raw).trim();

  // 1. Remove JSON or structured objects if accidentally passed
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      text = parsed.text || parsed.explanation || parsed.title || text;
    } catch (_) {}
  }

  // 2. Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, ' [code snippet] ');
  text = text.replace(/`([^`]+)`/g, '$1');

  // 3. Remove Markdown links, keeping only text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 4. Remove Markdown bold/italics
  text = text.replace(/[*_~]+/g, '');

  // 5. Remove Markdown headers & bullets
  text = text.replace(/^[#\->*]\s+/gm, '');

  // 6. Mathematical and Scientific Spoken Translations
  text = text
    // Chemical formulas
    .replace(/\bH2O\b/gi, 'H two O')
    .replace(/\bCO2\b/gi, 'C O two')
    .replace(/\bO2\b/gi, 'O two')
    .replace(/\bN2\b/gi, 'N two')
    .replace(/\bNaCl\b/gi, 'N a C l')
    // Common algebraic equations
    .replace(/\bF\s*=\s*m\s*(\\cdot|\*|\.)\s*a\b/gi, 'F equals m times a')
    .replace(/\bF\s*=\s*m\s*a\b/gi, 'F equals m times a')
    .replace(/\bE\s*=\s*m\s*c\^2\b/gi, 'E equals m c squared')
    .replace(/\ba\^2\s*\+\s*b\^2\s*=\s*c\^2\b/gi, 'a squared plus b squared equals c squared')
    // LaTeX math symbols
    .replace(/\\times/g, ' times ')
    .replace(/\\cdot/g, ' times ')
    .replace(/\\approx/g, ' is approximately ')
    .replace(/\\le/g, ' is less than or equal to ')
    .replace(/\\ge/g, ' is greater than or equal to ')
    .replace(/\\ne/g, ' is not equal to ')
    .replace(/\\pi/g, ' pi ')
    .replace(/\\theta/g, ' theta ')
    .replace(/\\alpha/g, ' alpha ')
    .replace(/\\beta/g, ' beta ')
    .replace(/\\Delta/g, ' delta ')
    // Fractions \frac{a}{b}
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
    // Square root \sqrt{x}
    .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1')
    // Powers x^2 -> x squared, x^3 -> x cubed
    .replace(/(\w)\^2\b/g, '$1 squared')
    .replace(/(\w)\^3\b/g, '$1 cubed')
    .replace(/(\w)\^(\d+)\b/g, '$1 to the power of $2')
    // Percentages
    .replace(/(\d+)\s*%/g, '$1 percent')
    // Replace standalone math delimiters without stripping variables
    .replace(/\$/g, ' ');

  // 7. Normalize excess whitespace and line breaks
  text = text.replace(/\s+/g, ' ').trim();

  // Limit speech length per utterance for crisp conversational pacing (max 1500 chars)
  if (text.length > 1500) {
    const truncated = text.slice(0, 1500);
    const lastSentence = truncated.lastIndexOf('.');
    text = lastSentence > 400 ? truncated.slice(0, lastSentence + 1) : truncated + '...';
  }

  return text;
}

/**
 * Detects whether a string is primarily Hindi (Devanagari script)
 */
export function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Concurrency Mutex Queue for Edge TTS
 * Prevents Edge WebSocket 429 rate-limiting by serializing remote calls with safe spacing.
 */
class EdgeTtsQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private ttsClient: MsEdgeTTS | null = null;
  private currentVoice = '';

  private getClient(): MsEdgeTTS {
    if (!this.ttsClient) {
      this.ttsClient = new MsEdgeTTS();
    }
    return this.ttsClient;
  }

  public enqueue<T>(task: (client: MsEdgeTTS) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const client = this.getClient();
          const result = await task(client);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processNext();
    });
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } catch (_) {}
    }
    // Small inter-request breathing window (60ms) to ensure socket cleanliness
    setTimeout(() => {
      this.isProcessing = false;
      this.processNext();
    }, 60);
  }
}

const edgeQueue = new EdgeTtsQueue();

/**
 * Synthesizes a single segment of text with a specific verified Edge voice.
 */
async function synthesizeSegment(
  text: string,
  voiceId: string,
  speed: number = 1.0
): Promise<Buffer> {
  return edgeQueue.enqueue(async (client) => {
    // Configure voice metadata and audio format (24kHz 48kbps MP3)
    await client.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timeoutTimer = setTimeout(() => {
        reject(new Error(`Edge TTS generation timed out for voice "${voiceId}"`));
      }, 12000);

      try {
        const { audioStream } = client.toStream(text);

        audioStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        audioStream.on('close', () => {
          clearTimeout(timeoutTimer);
          if (chunks.length === 0) {
            reject(new Error('Edge TTS returned empty audio stream.'));
          } else {
            resolve(Buffer.concat(chunks));
          }
        });

        audioStream.on('error', (err: any) => {
          clearTimeout(timeoutTimer);
          reject(err);
        });
      } catch (streamErr) {
        clearTimeout(timeoutTimer);
        reject(streamErr);
      }
    });
  });
}

/**
 * Main Text-To-Speech Synthesis function.
 * Supports single voice or intelligent mixed Hindi-English sentence decomposition.
 */
export async function synthesizeEdgeSpeech(options: SynthesizeOptions): Promise<SynthesizeResult> {
  const clean = cleanTextForSpeech(options.text);
  if (!clean) {
    throw new Error('No speakable text provided.');
  }

  const speed = Math.max(0.75, Math.min(1.5, Number(options.speed) || 1.0));
  const defaultHindi = options.hindiVoiceId || 'hi-IN-SwaraNeural';
  const defaultEnglish = options.englishVoiceId || 'en-IN-NeerjaNeural';

  // 1. Determine Voice Selection
  let selectedVoice = options.voiceId;
  const isDevanagari = containsDevanagari(clean);

  if (!selectedVoice) {
    selectedVoice = isDevanagari ? defaultHindi : defaultEnglish;
  }

  // 2. Check LRU Cache
  const cacheKey = getCacheKey(clean, selectedVoice, speed);
  const cachedEntry = audioCache.get(cacheKey);
  if (cachedEntry) {
    return {
      audioBuffer: cachedEntry.buffer,
      contentType: cachedEntry.contentType,
      voiceId: selectedVoice,
      durationMs: cachedEntry.durationMs,
      cached: true,
      charCount: clean.length
    };
  }

  const startTime = Date.now();
  let finalAudioBuffer: Buffer;

  // 3. Mixed Hindi-English Sentence Processing (if enabled and mixed content detected)
  const isMixed = options.detectMixedLanguage && containsDevanagari(clean) && /[a-zA-Z]{3,}/.test(clean);

  if (isMixed) {
    // Split text by sentence boundaries (. | । | ? | !)
    const rawSentences = clean.split(/(?<=[.।?!])\s+/);
    const audioSegments: Buffer[] = [];

    for (const sentence of rawSentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      const sentenceVoice = containsDevanagari(trimmed) ? defaultHindi : defaultEnglish;
      try {
        const segBuf = await synthesizeSegment(trimmed, sentenceVoice, speed);
        audioSegments.push(segBuf);
      } catch (segErr) {
        console.warn(`[EdgeTTS] Segment synthesis fallback for "${trimmed.slice(0, 30)}":`, segErr);
      }
    }

    if (audioSegments.length > 0) {
      finalAudioBuffer = Buffer.concat(audioSegments);
    } else {
      // Fallback to synthesizing the entire string with selected voice
      finalAudioBuffer = await synthesizeSegment(clean, selectedVoice, speed);
    }
  } else {
    // Standard direct synthesis
    finalAudioBuffer = await synthesizeSegment(clean, selectedVoice, speed);
  }

  const durationMs = Date.now() - startTime;

  // 4. Save to Cache
  if (audioCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = audioCache.keys().next().value;
    if (oldestKey) audioCache.delete(oldestKey);
  }

  audioCache.set(cacheKey, {
    buffer: finalAudioBuffer,
    contentType: 'audio/mpeg',
    durationMs,
    createdAt: Date.now()
  });

  return {
    audioBuffer: finalAudioBuffer,
    contentType: 'audio/mpeg',
    voiceId: selectedVoice,
    durationMs,
    cached: false,
    charCount: clean.length
  };
}
