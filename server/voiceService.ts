/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Voice Service
 * - Text-To-Speech (TTS): Delegates to local Microsoft Edge TTS synthesizer
 * - Speech-To-Text (STT): Not supported by Ministral/Groq text models; clients use browser SpeechRecognition
 */

import { synthesizeEdgeSpeech } from './edgeTtsService';

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
 * Converts text into spoken audio using Edge TTS.
 */
export async function generateVoiceTTS(options: TTSRequestOptions): Promise<{ audioBuffer: Buffer; contentType: string }> {
  const cleanText = (options.text || '').slice(0, 4000).trim();
  if (!cleanText) {
    throw new Error('Text input is empty');
  }
  const result = await synthesizeEdgeSpeech({
    text: cleanText,
    speed: options.speed || 1.0
  });
  return {
    audioBuffer: result.audioBuffer,
    contentType: result.contentType || 'audio/mpeg'
  };
}

/**
 * Server-side STT is unavailable because approved AI models (Ministral / Groq text) do not expose audio transcription here.
 */
export async function transcribeVoiceSTT(_audioBuffer: Buffer, _mimeType = 'audio/webm'): Promise<STTResponse> {
  return {
    success: false,
    text: '',
    error: 'Server audio transcription is unsupported on the active Ministral/Groq text stack. Use browser speech recognition or text input.'
  };
}
