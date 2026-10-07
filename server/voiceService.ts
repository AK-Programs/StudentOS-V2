/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Voice Service
 * Powered by APInex Voice Tools (TTS & STT)
 * Endpoints:
 * - Text-To-Speech (TTS): POST https://api.apinex.bond/v1/audio/speech
 * - Speech-To-Text (STT): POST https://api.apinex.bond/v1/audio/transcriptions
 */

import { getApinexApiKey } from './aiClient';

export interface TTSRequestOptions {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number;
}

export interface STTResponse {
  success: boolean;
  text: string;
  error?: string;
}

/**
 * Converts text into spoken audio using APInex Text-To-Speech (TTS).
 * Returns audio buffer (MP3 format).
 */
export async function generateApinexTTS(options: TTSRequestOptions): Promise<{ audioBuffer: Buffer; contentType: string }> {
  const apiKey = getApinexApiKey();
  if (!apiKey) {
    throw new Error('APINEX_API_KEY is not configured on the server.');
  }

  const cleanText = (options.text || '').slice(0, 4000).trim();
  if (!cleanText) {
    throw new Error('Text input is empty');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch('https://api.apinex.bond/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: cleanText,
        voice: options.voice || 'nova',
        speed: options.speed || 1.0
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`APInex TTS HTTP ${resp.status}: ${errText.slice(0, 140)}`);
    }

    const arrayBuffer = await resp.arrayBuffer();
    return {
      audioBuffer: Buffer.from(arrayBuffer),
      contentType: 'audio/mpeg'
    };
  } catch (err: any) {
    clearTimeout(timer);
    console.error('[APInex TTS Error]:', err?.message || err);
    throw err;
  }
}

/**
 * Transcribes audio buffer/file into text using APInex Speech-To-Text (STT).
 */
export async function transcribeApinexSTT(audioBuffer: Buffer, mimeType = 'audio/webm'): Promise<STTResponse> {
  const apiKey = getApinexApiKey();
  if (!apiKey) {
    return { success: false, text: '', error: 'APINEX_API_KEY is not configured on the server.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'recording.webm');
    formData.append('model', 'whisper-1');

    const resp = await fetch('https://api.apinex.bond/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return { success: false, text: '', error: `APInex STT HTTP ${resp.status}: ${errText.slice(0, 140)}` };
    }

    const data = await resp.json();
    const text = (data.text || data.transcription || '').trim();

    return {
      success: true,
      text
    };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      success: false,
      text: '',
      error: err?.message || 'STT transcription failed.'
    };
  }
}
