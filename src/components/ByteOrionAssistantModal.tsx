import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Mic, MicOff, Send, X, Volume2, VolumeX, ArrowRight, 
  Brain, Bot, Shield, CheckCircle2, ChevronRight, MessageSquare, AlertCircle
} from 'lucide-react';
import { Byte3DCanvas } from './byte/Byte3DCanvas';
import { Orion3DOrb } from './ui/Orion3DOrb';
import { soundService } from '../lib/soundService';
import { byteVoiceService } from '../lib/byteVoiceService';

export interface ByteReminderItem {
  id: string;
  title: string;
  subtitle?: string;
  type: 'urgent' | 'class' | 'assignment' | 'assessment' | 'announcement' | 'attendance' | 'task';
  actionLabel?: string;
  actionTab?: string;
  timestamp?: string;
}

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
  const [mode, setMode] = useState<'select' | 'byte' | 'orion'>(initialMode);
  const [speechText, setSpeechText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [orionInput, setOrionInput] = useState('');
  const [orionLoading, setOrionLoading] = useState(false);
  const [orionResponse, setOrionResponse] = useState<string | null>(null);
  const [voiceVolumeEnabled, setVoiceVolumeEnabled] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setMode(initialMode);
    setSpeechText('');
    setOrionResponse(null);
  }, [initialMode, isOpen]);

  // Speech Recognition initialization
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceSupported(false);
    }
  }, []);

  const startVoiceInput = async (target: 'byte' | 'orion') => {
    if (isListening) {
      stopVoiceInput();
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceSupported(false);
      showNotification?.('Speech recognition is not supported in this browser. Please type your message.');
      return;
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
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
        setSpeechText(transcript);
        if (target === 'orion') {
          setOrionInput(transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('[Speech Recognition Event]:', event.error);
        if (event.error === 'not-allowed') {
          setPermissionDenied(true);
          showNotification?.('Microphone permission was denied. Please allow microphone access or type.');
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err: any) {
      console.warn('[Microphone Permission Error]:', err);
      setPermissionDenied(true);
      setIsListening(false);
      showNotification?.('Could not access microphone. Please type your query.');
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleSelectByte = () => {
    soundService.playButtonClick();
    setMode('byte');
    startVoiceInput('byte');
  };

  const handleSelectOrion = () => {
    soundService.playButtonClick();
    setMode('orion');
    startVoiceInput('orion');
  };

  const handleSendOrionPrompt = async () => {
    const promptToSend = orionInput.trim() || speechText.trim();
    if (!promptToSend) return;

    stopVoiceInput();
    setOrionLoading(true);
    setOrionResponse(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          persona: effectiveRole === 'teacher' || effectiveRole === 'coordinator' ? 'faculty_mentor' : 'orion',
          context: `User Role: ${effectiveRole}. Name: ${currentUser?.name || 'User'}. Grade: ${currentUser?.grade || 'General'}. School: ${currentUser?.schoolName || 'Veylentra'}.`
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data.text || data.response || 'I have analyzed your request.';
      setOrionResponse(reply);

      if (voiceVolumeEnabled) {
        byteVoiceService.speak(reply.slice(0, 200));
      }
    } catch (err: any) {
      setOrionResponse('I encountered a connection issue while answering. Please try again.');
    } finally {
      setOrionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            {mode === 'select' && (
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
            )}
            {mode === 'byte' && (
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-amber-400" />
              </div>
            )}
            {mode === 'orion' && (
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Brain className="w-4 h-4 text-indigo-400" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {mode === 'select' && 'Companion & Intelligence'}
                {mode === 'byte' && 'Byte · Productivity Companion'}
                {mode === 'orion' && 'Orion · Academic Intelligence'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {mode === 'select' && 'Choose your context-aware assistant'}
                {mode === 'byte' && 'Reminders, schedules & daily priorities'}
                {mode === 'orion' && 'Concept explanations, drafting & analysis'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {mode !== 'select' && (
              <button
                type="button"
                onClick={() => {
                  stopVoiceInput();
                  setMode('select');
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                Switch
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopVoiceInput();
                onClose();
              }}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* 1. SELECTION SCREEN */}
          {mode === 'select' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Hold completed! Select the companion you need right now:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: BYTE */}
                <button
                  type="button"
                  onClick={handleSelectByte}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-500/5 text-left transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Byte3DCanvas size={42} mood="wave" interactiveGaze={false} />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                      Productivity
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                      Byte Companion
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Daily reminders, upcoming classes, pending assignments & school circulars.
                    </p>
                  </div>
                  <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center text-xs font-semibold text-cyan-400 group-hover:translate-x-1 transition-transform">
                    <span>Open Reminders</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </button>

                {/* Option 2: ORION */}
                <button
                  type="button"
                  onClick={handleSelectOrion}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-left transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <Orion3DOrb size={36} />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                      AI Work
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Orion Intelligence
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Concept explanations, draft assignments, summarize notes & solve doubts.
                    </p>
                  </div>
                  <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
                    <span>Ask Orion AI</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs text-slate-400">
                <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Voice input automatically starts after selecting your assistant.</span>
              </div>
            </div>
          )}

          {/* 2. BYTE COMPANION VIEW */}
          {mode === 'byte' && (
            <div className="space-y-4">
              {/* Voice Recognition Status Banner */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-cyan-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isListening ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-cyan-500/20 text-cyan-400'}`}>
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {isListening ? 'Listening to voice...' : speechText ? 'Recognized speech:' : 'Tap mic to speak to Byte'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                      {speechText || 'Ask about today\'s classes or due homework'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => startVoiceInput('byte')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isListening ? 'bg-rose-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  }`}
                >
                  {isListening ? 'Stop' : 'Speak'}
                </button>
              </div>

              {permissionDenied && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Microphone access was denied. You can review your reminders below.</span>
                </div>
              )}

              {/* Reminders List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
                  <span>Authoritative Reminders</span>
                  <span>{reminders.length} items</span>
                </div>

                {reminders.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-950/40 border border-white/5 text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    <p className="text-xs font-bold text-white">All caught up!</p>
                    <p className="text-[11px] text-slate-400">No pending assignments or urgent alerts for today.</p>
                  </div>
                ) : (
                  reminders.map((rem) => (
                    <div
                      key={rem.id}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 hover:border-cyan-500/30 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white leading-snug">{rem.title}</p>
                        {rem.subtitle && (
                          <p className="text-[11px] text-slate-400">{rem.subtitle}</p>
                        )}
                      </div>

                      {rem.actionTab && (
                        <button
                          type="button"
                          onClick={() => {
                            soundService.playButtonClick();
                            onClose();
                            onNavigateTab(rem.actionTab!);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-cyan-300 hover:text-white border border-white/10 shrink-0 transition-colors"
                        >
                          {rem.actionLabel || 'View'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 3. ORION AI VIEW */}
          {mode === 'orion' && (
            <div className="space-y-4">
              {/* Voice recognition banner */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-indigo-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isListening ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {isListening ? 'Listening to prompt...' : 'Voice or Typed Query'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                      {speechText || 'Speak or type what you need help with'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => startVoiceInput('orion')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isListening ? 'bg-rose-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isListening ? 'Stop' : 'Speak'}
                </button>
              </div>

              {/* Text Input Row */}
              <div className="relative">
                <textarea
                  value={orionInput}
                  onChange={(e) => setOrionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendOrionPrompt();
                    }
                  }}
                  rows={2}
                  placeholder={
                    effectiveRole === 'teacher' || effectiveRole === 'coordinator'
                      ? 'Ask Orion to draft an assignment, lesson plan, or quiz...'
                      : 'Ask Orion to explain a concept, summarize notes, or solve a problem...'
                  }
                  className="w-full p-3 rounded-2xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <button
                      type="button"
                      onClick={() => setVoiceVolumeEnabled(!voiceVolumeEnabled)}
                      className="inline-flex items-center gap-1 hover:text-white transition-colors"
                    >
                      {voiceVolumeEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                      <span>{voiceVolumeEnabled ? 'Voice reply enabled' : 'Muted'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={orionLoading || (!orionInput.trim() && !speechText.trim())}
                    onClick={handleSendOrionPrompt}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    {orionLoading ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{orionLoading ? 'Processing...' : 'Send'}</span>
                  </button>
                </div>
              </div>

              {/* Orion Response Box */}
              {orionResponse && (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-indigo-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                      <Brain className="w-3 h-3" />
                      <span>Orion Intelligence Response</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenOrionFull?.(orionInput);
                      }}
                      className="text-[10px] text-slate-400 hover:text-white underline font-semibold"
                    >
                      Open Full Copilot
                    </button>
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                    {orionResponse}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
