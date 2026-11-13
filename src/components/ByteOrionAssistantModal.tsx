/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Veylentra — Byte / Orion Selector & Voice STT Modal
 * - Explicit Byte (non-AI deterministic reminders & schedule) vs Orion (AI academic assistant)
 * - Explicit user-triggered voice capture with listening indicator, Cancel/Stop controls,
 *   editable transcript textarea before sending, and clean typing fallback on permission denial
 * - Calls /api/ai/orion-assist strictly through APInex / Ministral / Groq for Orion
 * - Explicit user confirmation required before saving any Orion draft as a Note
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Mic,
  MicOff,
  Send,
  X,
  Volume2,
  VolumeX,
  ArrowRight,
  Brain,
  Bot,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { Byte3DCanvas } from './byte/Byte3DCanvas';
import { Orion3DOrb } from './ui/Orion3DOrb';
import { soundService } from '../lib/soundService';
import { byteVoiceService } from '../lib/byteVoiceService';
import {
  ByteReminderItem,
  answerByteQueryLocally,
  dismissByteReminder,
  markByteReminderHandled,
  snoozeByteReminder,
  loadByteReminderState
} from '../lib/byteReminderEngine';
import { supabase } from '../lib/supabase';
import { saveVaultNoteToSupabase } from '../lib/supabaseNotes';

interface ByteOrionAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'select' | 'byte' | 'orion';
  currentUser: any;
  effectiveRole: string;
  reminders: ByteReminderItem[];
  onNavigateTab: (tabId: string) => void;
  onOpenOrionFull?: (initialQuery?: string) => void;
  showNotification?: (msg: string) => void;
}

export const ByteOrionAssistantModal: React.FC<ByteOrionAssistantModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'select',
  currentUser,
  effectiveRole,
  reminders = [],
  onNavigateTab,
  onOpenOrionFull,
  showNotification
}) => {
  const userId = currentUser?.uid || currentUser?.email || 'guest';

  const [mode, setMode] = useState<'select' | 'byte' | 'orion'>(initialMode);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Byte deterministic query & persisted state sync
  const [byteQueryInput, setByteQueryInput] = useState('');
  const [byteLocalSummary, setByteLocalSummary] = useState<string | null>(null);
  const [reminderRefreshKey, setReminderRefreshKey] = useState(0);

  // Orion AI query & confirmation-before-save state
  const [orionInput, setOrionInput] = useState('');
  const [orionLoading, setOrionLoading] = useState(false);
  const [orionError, setOrionError] = useState<string | null>(null);
  const [orionResponse, setOrionResponse] = useState<string | null>(null);
  const [orionProviderMeta, setOrionProviderMeta] = useState<string | null>(null);
  const [savingOrionNote, setSavingOrionNote] = useState(false);
  const [voiceVolumeEnabled, setVoiceVolumeEnabled] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setMode(initialMode);
    setByteQueryInput('');
    setByteLocalSummary(null);
    setOrionInput('');
    setOrionError(null);
    setOrionResponse(null);
    setOrionProviderMeta(null);
    setPermissionDenied(false);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(Boolean(SpeechRec));
    return () => {
      stopVoiceInput();
      byteVoiceService.stop();
    };
  }, []);

  // Re-filter reminders against persisted dismiss/handled/snooze state
  const visibleReminders = useMemo(() => {
    const persisted = loadByteReminderState(userId);
    const nowMs = Date.now();
    return reminders.filter(r => {
      if (persisted.dismissedIds.includes(r.id)) return false;
      if (persisted.handledIds.includes(r.id)) return false;
      const snoozed = persisted.snoozedUntil[r.id];
      if (typeof snoozed === 'number' && snoozed > nowMs) return false;
      return true;
    });
  }, [reminders, userId, reminderRefreshKey]);

  const byteMatchedResult = useMemo(() => {
    if (!byteQueryInput.trim()) {
      return {
        summary: byteLocalSummary,
        matchingReminders: visibleReminders
      };
    }
    return answerByteQueryLocally(byteQueryInput, visibleReminders);
  }, [byteQueryInput, byteLocalSummary, visibleReminders]);

  const stopVoiceInput = (clearBuffer = false) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    if (clearBuffer) {
      if (mode === 'byte') setByteQueryInput('');
      if (mode === 'orion') setOrionInput('');
    }
  };

  const startVoiceInput = async (target: 'byte' | 'orion') => {
    if (isListening) {
      stopVoiceInput(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceSupported(false);
      showNotification?.('Browser speech recognition is unavailable. Please type your query below.');
      return;
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      }
      setPermissionDenied(false);

      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        soundService.playButtonClick();
      };

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (target === 'byte') {
          setByteQueryInput(transcript);
        } else {
          setOrionInput(transcript);
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setPermissionDenied(true);
          showNotification?.('Microphone access denied. Please type your query instead.');
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setPermissionDenied(true);
      setIsListening(false);
      showNotification?.('Microphone could not be accessed. Type your query directly below.');
    }
  };

  const handleRunByteQuery = () => {
    stopVoiceInput(false);
    soundService.playButtonClick();
    const res = answerByteQueryLocally(byteQueryInput, visibleReminders);
    setByteLocalSummary(res.summary);
    if (voiceVolumeEnabled && res.summary) {
      byteVoiceService.speak(res.summary.slice(0, 220));
    }
  };

  const handleSendOrionPrompt = async () => {
    const promptToSend = orionInput.trim();
    if (!promptToSend) return;

    stopVoiceInput(false);
    setOrionLoading(true);
    setOrionError(null);
    setOrionResponse(null);
    setOrionProviderMeta(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const isFaculty = ['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(
        String(effectiveRole || '').toLowerCase()
      );

      const resp = await fetch('/api/ai/orion-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          userId,
          userRole: effectiveRole || 'student',
          intent: isFaculty ? 'draft_lesson_plan' : 'student_explain',
          subject: currentUser?.department || 'General Studies',
          grade: currentUser?.grade || 'Grade 10',
          topic: promptToSend,
          contextData: `Invoked from Voice/Quick Modal. User: ${currentUser?.name || 'User'}.`
        })
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || `Request failed (${resp.status})`);
      }

      const reply = data.text || 'Response received.';
      setOrionResponse(reply);
      if (data.providerUsed) {
        setOrionProviderMeta(`${data.providerUsed}${data.modelUsed ? ` · ${data.modelUsed}` : ''}`);
      }

      if (voiceVolumeEnabled) {
        byteVoiceService.speak(reply.slice(0, 220));
      }
    } catch (err: any) {
      setOrionError(err?.message || 'Could not reach Orion right now. Please try again.');
    } finally {
      setOrionLoading(false);
    }
  };

  const handleConfirmSaveOrionAsNote = async () => {
    if (!orionResponse) return;
    setSavingOrionNote(true);
    soundService.playButtonClick();
    try {
      const title = orionInput.trim().slice(0, 64) || 'Orion Quick Note';
      await saveVaultNoteToSupabase(
        {
          id: `note-orion-${Date.now()}`,
          title,
          subject: 'Orion Assist',
          content: orionResponse,
          createdAt: new Date().toLocaleDateString(),
          userId
        },
        userId
      );
      showNotification(`✓ Saved "${title}" to Lecture Notes.`);
    } catch {
      showNotification('Could not save note right now.');
    } finally {
      setSavingOrionNote(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            {mode === 'select' && (
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                <Mic className="w-4 h-4 text-sky-400" />
              </div>
            )}
            {mode === 'byte' && (
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-cyan-400" />
              </div>
            )}
            {mode === 'orion' && (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Brain className="w-4 h-4 text-emerald-400" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {mode === 'select' && 'Choose Companion or AI Assistant'}
                {mode === 'byte' && 'Byte · Non-AI Productivity Companion'}
                {mode === 'orion' && 'Orion · AI Academic Intelligence'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {mode === 'select' && 'Select Byte for schedule & reminders, or Orion for AI study/faculty help'}
                {mode === 'byte' && 'Deterministic reminders from real tasks, schedule & homework'}
                {mode === 'orion' && 'Concept help, study plans, and confirmation-gated drafts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {mode !== 'select' && (
              <button
                type="button"
                onClick={() => {
                  stopVoiceInput(false);
                  setMode('select');
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                Switch
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopVoiceInput(false);
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Close assistant modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* =================================================================
              1. MODE SELECTOR
          ================================================================== */}
          {mode === 'select' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => {
                    soundService.playButtonClick();
                    setMode('byte');
                  }}
                  className="p-4 rounded-2xl bg-slate-950/70 border border-cyan-500/25 hover:border-cyan-400/60 text-left transition-colors cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Byte3DCanvas size={42} mood="wave" interactiveGaze={false} />
                    </div>
                    <span className="text-[10px] font-bold uppercase text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                      Non-AI · Reminders
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Byte Companion</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Review due assignments, next class, low attendance alerts, and mark items done or snoozed.
                    </p>
                  </div>
                  <div className="pt-2.5 border-t border-slate-800 flex items-center text-xs font-bold text-cyan-400">
                    <span>Open Byte</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundService.playButtonClick();
                    setMode('orion');
                  }}
                  className="p-4 rounded-2xl bg-slate-950/70 border border-sky-500/25 hover:border-sky-400/60 text-left transition-colors cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                      <Orion3DOrb size={36} />
                    </div>
                    <span className="text-[10px] font-bold uppercase text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                      AI Copilot
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Orion Intelligence</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Explain topics, generate study plans, or draft faculty resources with explicit save confirmation.
                    </p>
                  </div>
                  <div className="pt-2.5 border-t border-slate-800 flex items-center text-xs font-bold text-sky-400">
                    <span>Ask Orion AI</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Voice input is optional and starts only when you click Listen. You can edit any transcript or type directly.
              </p>
            </div>
          )}

          {/* =================================================================
              2. BYTE DETERMINISTIC COMPANION (NO AI)
          ================================================================== */}
          {mode === 'byte' && (
            <div className="space-y-4">
              {/* Explicit Voice Controls + Editable Transcript */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isListening ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-cyan-500/15 text-cyan-400'
                      }`}
                    >
                      {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {isListening ? 'Listening...' : 'Ask Byte (Local Search Only)'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Matches classes, assignments, attendance, exams, or flashcards
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isListening && (
                      <button
                        type="button"
                        onClick={() => stopVoiceInput(true)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!voiceSupported}
                      onClick={() => startVoiceInput('byte')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40 ${
                        isListening
                          ? 'bg-rose-600 text-white'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      }`}
                    >
                      {isListening ? 'Stop' : 'Listen'}
                    </button>
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={byteQueryInput}
                  onChange={e => setByteQueryInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleRunByteQuery();
                    }
                  }}
                  placeholder="Edit voice transcript or type e.g. 'next class', 'homework due', 'attendance'..."
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setVoiceVolumeEnabled(v => !v)}
                    className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    {voiceVolumeEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{voiceVolumeEnabled ? 'Read summary aloud' : 'Voice reply off'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRunByteQuery}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Check Schedule & Reminders</span>
                  </button>
                </div>
              </div>

              {(!voiceSupported || permissionDenied) && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {permissionDenied
                      ? 'Microphone permission was denied. Type your question in the box above.'
                      : 'Voice capture is not supported in this browser. Type your question above.'}
                  </span>
                </div>
              )}

              {byteMatchedResult.summary && (
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-100 leading-relaxed">
                  {byteMatchedResult.summary}
                </div>
              )}

              {/* Active Deterministic Reminders */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
                  <span>Active Reminders</span>
                  <span className="tabular-nums">{byteMatchedResult.matchingReminders.length} items</span>
                </div>

                {byteMatchedResult.matchingReminders.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    <p className="text-xs font-bold text-white">All caught up</p>
                    <p className="text-[11px] text-slate-400">No active reminders matching your query right now.</p>
                  </div>
                ) : (
                  byteMatchedResult.matchingReminders.map(rem => (
                    <div
                      key={rem.id}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-white leading-snug">{rem.title}</p>
                          {rem.subtitle && <p className="text-[11px] text-slate-400">{rem.subtitle}</p>}
                          {rem.reason && <p className="text-[11px] text-slate-300">{rem.reason}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            dismissByteReminder(userId, rem.id);
                            setReminderRefreshKey(k => k + 1);
                          }}
                          className="p-1 text-slate-500 hover:text-white cursor-pointer"
                          title="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              markByteReminderHandled(userId, rem.id);
                              setReminderRefreshKey(k => k + 1);
                            }}
                            className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Done</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              snoozeByteReminder(userId, rem.id);
                              setReminderRefreshKey(k => k + 1);
                            }}
                            className="px-2 py-1 rounded-md bg-slate-900 text-slate-300 border border-slate-700 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Clock className="w-3 h-3" />
                            <span>Snooze 1h</span>
                          </button>
                        </div>

                        {rem.actionTab && (
                          <button
                            type="button"
                            onClick={() => {
                              soundService.playButtonClick();
                              onClose();
                              onNavigateTab(rem.actionTab!);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-cyan-300 cursor-pointer"
                          >
                            {rem.actionLabel || 'Open'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              3. ORION AI VIEW
          ================================================================== */}
          {mode === 'orion' && (
            <div className="space-y-4">
              {/* Voice Input Controls */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isListening ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-sky-500/15 text-sky-400'
                    }`}
                  >
                    {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {isListening ? 'Listening for your voice...' : 'Optional Voice Input'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {isListening ? 'Speak clearly — transcript appears below for review' : 'Tap Listen or type directly below'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isListening && (
                    <button
                      type="button"
                      onClick={() => stopVoiceInput(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!voiceSupported}
                    onClick={() => startVoiceInput('orion')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40 ${
                      isListening ? 'bg-rose-600 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'
                    }`}
                  >
                    {isListening ? 'Stop' : 'Listen'}
                  </button>
                </div>
              </div>

              {(!voiceSupported || permissionDenied) && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {permissionDenied
                      ? 'Microphone permission denied. Type and send your question below.'
                      : 'Voice capture unavailable in this browser. Type your question below.'}
                  </span>
                </div>
              )}

              {/* Editable Transcript / Query Box */}
              <div className="space-y-2">
                <textarea
                  value={orionInput}
                  onChange={e => setOrionInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendOrionPrompt();
                    }
                  }}
                  rows={3}
                  placeholder={
                    ['teacher', 'coordinator', 'hod'].includes(String(effectiveRole || '').toLowerCase())
                      ? 'Edit transcript or ask Orion to draft a lesson plan, quiz, or cohort summary...'
                      : 'Edit transcript or ask Orion to explain a concept, summarize notes, or plan revision...'
                  }
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
                />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setVoiceVolumeEnabled(v => !v)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    {voiceVolumeEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{voiceVolumeEnabled ? 'Voice reply on' : 'Muted'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        stopVoiceInput(false);
                        onClose();
                        onOpenOrionFull?.(orionInput);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      Open Full Copilot
                    </button>
                    <button
                      type="button"
                      disabled={orionLoading || !orionInput.trim()}
                      onClick={handleSendOrionPrompt}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {orionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{orionLoading ? 'Thinking...' : 'Ask Orion'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {orionError && (
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between gap-2">
                  <span>{orionError}</span>
                  <button
                    type="button"
                    onClick={handleSendOrionPrompt}
                    className="text-rose-200 underline font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {orionResponse && (
                <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5" />
                      <span>Orion Response {orionProviderMeta ? `(${orionProviderMeta})` : ''}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenOrionFull?.(orionInput);
                      }}
                      className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      Continue in Full View
                    </button>
                  </div>

                  <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto">
                    {orionResponse}
                  </p>

                  <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Review before saving to your notes</span>
                    </span>
                    <button
                      type="button"
                      disabled={savingOrionNote}
                      onClick={handleConfirmSaveOrionAsNote}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      {savingOrionNote ? 'Saving...' : 'Confirm & Save to Notes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
