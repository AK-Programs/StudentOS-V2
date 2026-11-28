/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Byte AI Workspace (Redesigned Multi-Role Studio)
 * - Tailored to all 6 Veylentra roles (student, teacher, coordinator/hod, admin, super_admin, parent)
 * - Streaming-safe LaTeX/chemistry/code rendering via AcademicRichRenderer
 * - Explicit state machine indicator synced to real input, retrieval, streaming, finished, and error states
 * - Inline "Teach Me Anything" launcher (no window.prompt), thread drawer with long-press menu support
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  Cpu,
  Globe,
  History,
  Layers,
  Paperclip,
  Pin,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
  Zap
} from 'lucide-react';
import { AI_PERSONAS } from '../../mockData';
import { AcademicRichRenderer } from '../ui/AcademicRichRenderer';
import { ByteStatusAvatar, ByteAssistantState, BYTE_STATE_LABELS } from './ByteStatusAvatar';
import {
  detectMathInteractiveWidget,
  extractTopicTeachingIntent,
  InteractiveMathWidget,
  saveStudyOutputToFlashcards
} from '../../lib/studentosAiEngine';
import { ROLE_CAPABILITY_PROFILES, normalizeByteRole } from '../../lib/byteIntelligence';
import { MOTION_DURATION, MOTION_EASE, useReducedMotionPreference } from '../../lib/motionSystem';

export interface ByteWorkspaceProps {
  currentUser: any;
  effectiveRole: string;
  activeTab: string;
  aiThreads: any[];
  activeThread: any;
  activeThreadId: string;
  setActiveThreadId: (id: string) => void;
  showAiHistoryDrawer: boolean;
  setShowAiHistoryDrawer: (open: boolean) => void;
  selectedPersona: string;
  aiMode: 'explanatory' | 'socratic' | 'coder' | 'quiz_gen';
  aiReasoningMode: boolean;
  setAiReasoningMode: (val: boolean) => void;
  aiWebSearchMode: 'auto' | 'force' | 'off';
  setAiWebSearchMode: (mode: 'auto' | 'force' | 'off') => void;
  aiModelOverride: string;
  setAiModelOverride: (val: string) => void;
  aiUsageState: {
    used: number;
    limit: number;
    remaining: number;
    nextAvailableInMinutes?: number;
  };
  setShowQuotaModal: (open: boolean) => void;
  aiLoading: boolean;
  aiStatusMessage: string;
  aiGroundedInData: boolean;
  aiActiveModelLabel: string;
  aiInput: string;
  setAiInput: (val: string) => void;
  attachedFiles: any[];
  setAttachedFiles: (files: any[]) => void;
  aiFileInputRef: React.RefObject<HTMLInputElement | null>;
  aiAbortControllerRef: React.MutableRefObject<AbortController | null>;
  speakingMsgIdx: string | null;
  byteThreadContext: {
    holdingItemId: string | null;
    getItemBindProps: (id: string) => Record<string, any>;
    shouldSuppressClick: (id: string) => boolean;
  };
  aiThreadHoldMenu: { threadId: string } | null;
  setIsJarvisActive: (open: boolean) => void;
  setSelectedTopicForTutor: (topic: string) => void;
  onNavigateTab: (tabId: string) => void;
  handleCreateNewThread: () => void;
  handleSwitchPersona: (personaId: string) => void;
  handleSwitchMode: (mode: 'explanatory' | 'socratic' | 'coder' | 'quiz_gen') => void;
  handleClearThreadHistory: () => void;
  handleAskAIModel: (overrideQuery?: string | React.MouseEvent) => void;
  handleCopyToClipboard: (text: string) => void;
  handleSaveToNotes: (text: string) => void;
  handleToggleSpeakMessage: (text: string, msgKey: string) => void;
  handleFileUploadAction: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveAttachedFile: (fileName: string) => void;
  showNotification: (msg: string) => void;
}

export const ByteWorkspace: React.FC<ByteWorkspaceProps> = ({
  currentUser,
  effectiveRole,
  activeTab,
  aiThreads,
  activeThread,
  activeThreadId,
  setActiveThreadId,
  showAiHistoryDrawer,
  setShowAiHistoryDrawer,
  selectedPersona,
  aiMode,
  aiReasoningMode,
  setAiReasoningMode,
  aiWebSearchMode,
  setAiWebSearchMode,
  aiModelOverride,
  setAiModelOverride,
  aiUsageState,
  setShowQuotaModal,
  aiLoading,
  aiStatusMessage,
  aiGroundedInData,
  aiActiveModelLabel,
  aiInput,
  setAiInput,
  attachedFiles,
  setAttachedFiles,
  aiFileInputRef,
  aiAbortControllerRef,
  speakingMsgIdx,
  byteThreadContext,
  aiThreadHoldMenu,
  setIsJarvisActive,
  setSelectedTopicForTutor,
  onNavigateTab,
  handleCreateNewThread,
  handleSwitchPersona,
  handleSwitchMode,
  handleClearThreadHistory,
  handleAskAIModel,
  handleCopyToClipboard,
  handleSaveToNotes,
  handleToggleSpeakMessage,
  handleFileUploadAction,
  handleRemoveAttachedFile,
  showNotification
}) => {
  const reduced = useReducedMotionPreference();
  const normalizedRole = normalizeByteRole(effectiveRole || currentUser?.role);
  const roleProfile = ROLE_CAPABILITY_PROFILES[normalizedRole];

  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [showTeachTopicBar, setShowTeachTopicBar] = useState(false);
  const [teachTopicInput, setTeachTopicInput] = useState('');
  const [copiedMsgKey, setCopiedMsgKey] = useState<string | null>(null);
  const [recentFinishFlag, setRecentFinishFlag] = useState(false);

  const prevAiLoadingRef = useRef(aiLoading);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const messages: any[] = activeThread?.messages || [];
  const lastAssistantMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  // Brief "finished" indicator transition when streaming completes without error
  useEffect(() => {
    if (prevAiLoadingRef.current && !aiLoading) {
      const hasError = Boolean(lastAssistantMsg?.content?.includes('AI is temporarily unavailable'));
      if (!hasError && lastAssistantMsg?.content) {
        setRecentFinishFlag(true);
        const timer = setTimeout(() => setRecentFinishFlag(false), 3500);
        prevAiLoadingRef.current = aiLoading;
        return () => clearTimeout(timer);
      }
    }
    prevAiLoadingRef.current = aiLoading;
  }, [aiLoading, lastAssistantMsg]);

  // Smooth auto-scroll on new messages / active stream
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 220 || aiLoading) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, lastAssistantMsg?.content?.length, aiLoading]);

  // Derive real Byte Assistant State
  const assistantState: ByteAssistantState = useMemo(() => {
    if (aiLoading) {
      const lowerStatus = (aiStatusMessage || '').toLowerCase();
      if (lowerStatus.includes('search') || lowerStatus.includes('source') || lowerStatus.includes('reading')) {
        return 'operating';
      }
      if (lastAssistantMsg && lastAssistantMsg.content && lastAssistantMsg.content.length > 0) {
        return 'generating';
      }
      return 'thinking';
    }
    if (lastAssistantMsg?.content?.includes('AI is temporarily unavailable')) {
      return 'error';
    }
    if (recentFinishFlag) {
      return 'finished';
    }
    if (isComposerFocused || aiInput.trim().length > 0) {
      return 'receiving_input';
    }
    return 'ready';
  }, [aiLoading, aiStatusMessage, lastAssistantMsg, recentFinishFlag, isComposerFocused, aiInput]);

  const quotaPct = Math.min(100, Math.round((aiUsageState.used / Math.max(1, aiUsageState.limit)) * 100));

  const submitTeachTopic = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = teachTopicInput.trim();
    if (!clean) return;
    setSelectedTopicForTutor(clean);
    setTeachTopicInput('');
    setShowTeachTopicBar(false);
  };

  const hasUserMessages = messages.some((m) => m.role === 'user');

  return (
    <div className="h-[calc(100dvh-130px)] flex flex-col smart-glass p-3 sm:p-4 rounded-3xl border border-white/10 shadow-xl relative w-full overflow-hidden">
      {/* Slide-out Study Threads Drawer */}
      <AnimatePresence>
        {showAiHistoryDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : MOTION_DURATION.fast }}
              onClick={() => setShowAiHistoryDrawer(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50"
            />
            <motion.div
              initial={reduced ? { opacity: 0 } : { x: '-100%' }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: '-100%' }}
              transition={{ duration: reduced ? 0 : 0.28, ease: MOTION_EASE.easeOutExpo }}
              className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-slate-950/95 border-r border-white/10 z-50 p-5 flex flex-col shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-bold text-sm text-white">Byte Sessions</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiHistoryDrawer(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Close session drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-3 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    handleCreateNewThread();
                    setShowAiHistoryDrawer(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Session</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1">
                {aiThreads.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-8">No saved Byte threads yet</p>
                ) : (
                  aiThreads.map((t) => {
                    const isHolding = byteThreadContext.holdingItemId === t.id;
                    const isContextActive = aiThreadHoldMenu?.threadId === t.id;
                    return (
                      <div
                        key={t.id}
                        {...byteThreadContext.getItemBindProps(t.id)}
                        data-holding={isHolding ? 'true' : undefined}
                        data-context-active={isContextActive ? 'true' : undefined}
                        onClick={() => {
                          if (byteThreadContext.shouldSuppressClick(t.id)) return;
                          setActiveThreadId(t.id);
                          if (t.attachedFiles) {
                            setAttachedFiles(t.attachedFiles);
                          } else if (t.attachedFile) {
                            setAttachedFiles([t.attachedFile]);
                          } else {
                            setAttachedFiles([]);
                          }
                          setShowAiHistoryDrawer(false);
                        }}
                        className={`veylentra-context-target group flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-colors relative ${
                          isHolding ? 'veylentra-context-holding' : ''
                        } ${isContextActive ? 'veylentra-context-active' : ''} ${
                          activeThreadId === t.id
                            ? 'border-indigo-500/70 bg-indigo-500/15'
                            : 'border-white/5 bg-slate-900/50 hover:bg-slate-900 hover:border-white/10'
                        }`}
                      >
                        {t.isPinned && <Pin className="w-2.5 h-2.5 text-amber-400 absolute top-1.5 right-1.5" />}
                        <div className="flex items-center gap-2.5 truncate max-w-[90%]">
                          <span className="text-sm shrink-0">
                            {AI_PERSONAS.find((p) => p.id === t.personaId)?.avatarChar || '💬'}
                          </span>
                          <div className="truncate">
                            <span className="text-xs text-slate-100 truncate font-semibold block leading-tight">
                              {t.title}
                            </span>
                            <span className="text-[10px] text-slate-400 capitalize">{t.mode}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Top Studio Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/10 pb-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <ByteStatusAvatar state={assistantState} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Byte</h2>
              <span className="text-[11px] font-medium text-indigo-300 truncate">
                {roleProfile.displayLabel} Assistant
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
              <span>{BYTE_STATE_LABELS[assistantState]}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{roleProfile.scopeBoundaryNote}</span>
            </p>
          </div>
        </div>

        {/* Workspace Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowAiHistoryDrawer(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
            title="Open session history"
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Sessions</span>
            <span className="text-[11px] font-mono tabular-nums text-indigo-300">{aiThreads.length}</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNewThread}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer"
            title="Start new conversation"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>

          <button
            type="button"
            onClick={() => setIsJarvisActive(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-500/35 text-sky-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
            title="Open Orion Ephemeral Action Agent"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Orion Agent</span>
          </button>

          {/* Persona Selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-xl px-2 py-1">
            <span className="text-xs shrink-0">
              {AI_PERSONAS.find((p) => p.id === selectedPersona)?.avatarChar || '🤖'}
            </span>
            <select
              value={selectedPersona}
              onChange={(e) => handleSwitchPersona(e.target.value)}
              className="bg-transparent text-slate-100 text-xs font-semibold focus:outline-none cursor-pointer pr-1 max-w-[115px] sm:max-w-[155px] truncate"
              title="Select Byte Persona"
            >
              {AI_PERSONAS.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.name} ({p.speciality})
                </option>
              ))}
            </select>
          </div>

          {/* Learning Mode Selector */}
          <div className="flex items-center bg-slate-900 border border-white/10 rounded-xl px-2 py-1">
            <select
              value={aiMode}
              onChange={(e) => handleSwitchMode(e.target.value as any)}
              className="bg-transparent text-indigo-300 text-xs font-semibold focus:outline-none cursor-pointer"
              title="Response style"
            >
              <option value="explanatory" className="bg-slate-900 text-white">
                Explainer
              </option>
              <option value="socratic" className="bg-slate-900 text-white">
                Socratic
              </option>
              <option value="coder" className="bg-slate-900 text-white">
                Coding
              </option>
              <option value="quiz_gen" className="bg-slate-900 text-white">
                Quiz Mode
              </option>
            </select>
          </div>

          {/* Reasoning Toggle */}
          <button
            type="button"
            onClick={() => setAiReasoningMode(!aiReasoningMode)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              aiReasoningMode
                ? 'bg-violet-500/20 text-violet-200 border-violet-500/45'
                : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
            }`}
            title="Toggle multi-step analytical reasoning"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{aiReasoningMode ? 'Deep Reasoning' : 'Reasoning'}</span>
          </button>

          {/* Web Search Selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-xl px-2 py-1">
            <Globe className={`w-3.5 h-3.5 shrink-0 ${aiWebSearchMode === 'off' ? 'text-slate-500' : 'text-teal-400'}`} />
            <select
              value={aiWebSearchMode}
              onChange={(e) => setAiWebSearchMode(e.target.value as 'auto' | 'force' | 'off')}
              className="bg-transparent text-teal-300 text-xs font-semibold focus:outline-none cursor-pointer"
              title="Web Grounding Mode"
            >
              <option value="auto" className="bg-slate-900 text-white">
                Web: Auto
              </option>
              <option value="force" className="bg-slate-900 text-white">
                Web: Search
              </option>
              <option value="off" className="bg-slate-900 text-white">
                Web: Off
              </option>
            </select>
          </div>

          {/* Super Admin Provider Selector */}
          {(currentUser?.role === 'super_admin' || effectiveRole === 'super_admin') && (
            <div className="flex items-center gap-1 bg-slate-900 border border-purple-500/35 rounded-xl px-2 py-1">
              <select
                value={aiModelOverride || 'auto'}
                onChange={(e) => setAiModelOverride(e.target.value === 'auto' ? '' : e.target.value)}
                className="bg-transparent text-purple-300 text-xs font-semibold focus:outline-none cursor-pointer"
                title="Super Admin Provider Override"
              >
                <option value="auto" className="bg-slate-900 text-white">
                  Provider: Auto
                </option>
                <option value="ministral" className="bg-slate-900 text-white">
                  Ministral
                </option>
                <option value="groq" className="bg-slate-900 text-white">
                  Groq
                </option>
              </select>
            </div>
          )}

          {/* Quota Meter & Clear */}
          <div className="flex items-center gap-1.5 pl-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-white/10 text-xs">
              <span className={`font-mono font-bold tabular-nums ${aiUsageState.remaining <= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {aiUsageState.remaining}
              </span>
              <span className="text-slate-500 font-mono text-[11px] tabular-nums">/{aiUsageState.limit}</span>
              <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden lg:block">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    aiUsageState.remaining <= 0 ? 'bg-rose-500' : quotaPct > 80 ? 'bg-amber-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowQuotaModal(true)}
                className="ml-0.5 text-amber-300 hover:text-amber-200 font-semibold text-[11px] flex items-center gap-0.5 cursor-pointer"
                title="Boost or view quota"
              >
                <Zap className="w-3 h-3" />
                <span className="hidden sm:inline">Boost</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleClearThreadHistory}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Clear messages in active session"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Classroom Strip + Inline Topic Input */}
      <div className="mt-2.5 shrink-0">
        <div className="px-3.5 py-2.5 rounded-2xl bg-slate-900/70 border border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 text-xs text-slate-300 min-w-0">
            <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="truncate">
              Interactive explanations, role-scoped Veylentra insights, and live LaTeX math · Active tab:{' '}
              <span className="text-white font-medium">{activeTab}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowTeachTopicBar((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/35 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Teach Me Anything</span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showTeachTopicBar && (
            <motion.form
              onSubmit={submitTeachTopic}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: reduced ? 0 : MOTION_DURATION.fast }}
              className="mt-2 p-2.5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 flex items-center gap-2"
            >
              <input
                type="text"
                value={teachTopicInput}
                onChange={(e) => setTeachTopicInput(e.target.value)}
                placeholder="Enter any topic for an interactive Byte lesson (e.g. Thermodynamics, Matrix Inverse)..."
                autoFocus
                className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!teachTopicInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
              >
                Start Lesson
              </button>
              <button
                type="button"
                onClick={() => setShowTeachTopicBar(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                aria-label="Cancel interactive topic"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Main Dialogue Stream */}
      <div
        id="ai-dialog-scroll"
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto pr-1.5 my-2.5 space-y-4 bg-slate-950/45 p-3 sm:p-5 rounded-2xl border border-white/5"
      >
        {/* Role-Aware Welcome Canvas when no user messages exist yet */}
        {!hasUserMessages && (
          <motion.div
            initial={reduced ? undefined : { opacity: 0, y: 8 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : MOTION_DURATION.normal, ease: MOTION_EASE.easeOutExpo }}
            className="max-w-3xl mx-auto py-4 space-y-6"
          >
            <div className="text-center space-y-2.5">
              <div className="flex justify-center">
                <ByteStatusAvatar state={assistantState} size="lg" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Hello, {currentUser?.name || roleProfile.displayLabel}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                {roleProfile.capabilitiesSummary}
              </p>
              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" /> {roleProfile.displayLabel} Scope
                </span>
                <span aria-hidden="true">·</span>
                <span>LaTeX Math & Chemistry Ready</span>
              </div>
            </div>

            {/* Role-Tailored Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {roleProfile.starterPrompts.map((item, idx) => (
                <motion.button
                  key={idx}
                  type="button"
                  whileHover={reduced ? undefined : { y: -2 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => handleAskAIModel(item.prompt)}
                  className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/45 text-left transition-colors cursor-pointer flex flex-col justify-between gap-2 group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                      {item.category}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-300 transition-colors" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors">
                      {item.title}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.subtitle}</p>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Quick Authorized Veylentra Module Links */}
            {roleProfile.modules.length > 0 && (
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-center gap-2 text-xs">
                <span className="text-[11px] text-slate-500 font-medium">Jump to module:</span>
                {roleProfile.modules.map((mod) => (
                  <button
                    key={mod.tabId}
                    type="button"
                    onClick={() => onNavigateTab(mod.tabId)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900/70 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                    title={mod.description}
                  >
                    {mod.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Messages */}
        {messages.map((m, idx) => {
          const msgKey = `${activeThread?.id || 'thread'}-${idx}`;
          const isSpeaking = speakingMsgIdx === msgKey;
          const prevUserMsg = idx > 0 && messages[idx - 1]?.role === 'user' ? messages[idx - 1].content : '';
          const mathWidget = m.role === 'assistant' ? detectMathInteractiveWidget(prevUserMsg, m.content) : null;
          const isLatestAssistant = m.role === 'assistant' && idx === messages.length - 1;
          const isActivelyStreamingMsg = isLatestAssistant && aiLoading;
          const detectedTopic =
            m.role === 'assistant'
              ? extractTopicTeachingIntent(prevUserMsg) || extractTopicTeachingIntent(m.content)
              : null;

          // Skip placeholder empty assistant bubble while waiting for first token (status strip shows below)
          if (isActivelyStreamingMsg && !m.content) {
            return null;
          }

          return (
            <motion.div
              key={msgKey}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: MOTION_EASE.easeOutExpo }}
              className={`p-4 rounded-2xl max-w-[94%] sm:max-w-[85%] overflow-hidden ${
                m.role === 'user'
                  ? 'bg-indigo-600/18 border border-indigo-500/30 text-white ml-auto'
                  : 'bg-slate-900/90 border border-white/10 text-slate-100 mr-auto'
              }`}
            >
              {/* Crisp Text Metadata Header (No stacked capsule badges) */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2 text-[11px] text-slate-400">
                <span className="font-semibold text-indigo-300">
                  {m.role === 'user' ? `${roleProfile.displayLabel}` : 'Byte'}
                </span>
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                    {m.webSearchUsed && (
                      <span className="text-teal-300">
                        Web Grounded{m.webSources?.length ? ` (${m.webSources.length})` : ''}
                      </span>
                    )}
                    {isLatestAssistant && aiGroundedInData && (
                      <>
                        {m.webSearchUsed && <span aria-hidden="true">·</span>}
                        <span className="text-emerald-300">Veylentra Context</span>
                      </>
                    )}
                    {isLatestAssistant && aiActiveModelLabel && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{aiActiveModelLabel.split('/').pop()}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Content Body via Streaming-Safe AcademicRichRenderer */}
              <AcademicRichRenderer
                content={m.content}
                isStreaming={isActivelyStreamingMsg}
                compact={false}
              />

              {isActivelyStreamingMsg && (
                <span
                  className="inline-block w-2 h-3.5 mt-1 bg-indigo-400 animate-pulse rounded-xs align-middle"
                  aria-label="Streaming response"
                />
              )}

              {/* Interactive Math Visualization */}
              {mathWidget && <InteractiveMathWidget widgetType={mathWidget} />}

              {/* Dynamic Lesson Launch Trigger */}
              {detectedTopic && !isActivelyStreamingMsg && (
                <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300 block">
                      Byte Interactive Classroom
                    </span>
                    <p className="text-xs font-semibold text-white mt-0.5">
                      Explore "{detectedTopic}" with step-by-step checkpoints
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTopicForTutor(detectedTopic)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shrink-0 cursor-pointer transition-colors"
                  >
                    Launch Lesson
                  </button>
                </div>
              )}

              {/* Verified Web Sources */}
              {m.role === 'assistant' && m.webSources && m.webSources.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/10 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300 font-semibold flex items-center gap-1.5">
                    <Globe className="w-3 h-3" /> Verified Sources ({m.webSources.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {m.webSources.map((src: any, sIdx: number) => (
                      <a
                        key={sIdx}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-2 p-2 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-white/10 hover:border-teal-500/40 transition-colors text-left"
                      >
                        <span className="text-teal-300 font-mono text-[10px] font-bold shrink-0">[{sIdx + 1}]</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-slate-200 group-hover:text-teal-300 truncate">
                            {src.title}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {src.domain}
                            {src.sourceType === 'academic' ? ' · Academic' : ''}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Attached Files Visual */}
              {m.files && m.files.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-2">
                  {m.files.map((file: any, fIdx: number) => (
                    <div
                      key={fIdx}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-[11px]"
                    >
                      <span className="font-medium text-slate-200 truncate max-w-[160px]">{file.name}</span>
                      <span className="text-slate-400 font-mono text-[10px] tabular-nums">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Assistant Utility Actions + Role-Tailored Follow-ups */}
              {m.role !== 'user' && m.content && !isActivelyStreamingMsg && (
                <div className="mt-3 pt-2.5 border-t border-white/10 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                    <button
                      type="button"
                      onClick={() => {
                        handleCopyToClipboard(m.content);
                        setCopiedMsgKey(msgKey);
                        setTimeout(() => setCopiedMsgKey(null), 1600);
                      }}
                      className="flex items-center gap-1 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-white/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedMsgKey === msgKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedMsgKey === msgKey ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveToNotes(m.content)}
                      className="flex items-center gap-1 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-white/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Save Note</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const res = await saveStudyOutputToFlashcards(
                          activeThread?.title || 'Byte Study Deck',
                          currentUser?.specialtySubject || 'General Studies',
                          m.content,
                          currentUser?.uid || 'guest'
                        );
                        showNotification(`Created Flashcard Deck (${res.count} cards) in Study Center.`);
                      }}
                      className="flex items-center gap-1 hover:text-white bg-slate-950/60 hover:bg-indigo-500/20 border border-white/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <Layers className="w-3 h-3" />
                      <span>Save Flashcards</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleSpeakMessage(m.content, msgKey)}
                      className={`flex items-center gap-1 border px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        isSpeaking
                          ? 'text-rose-300 border-rose-500/35 bg-rose-500/15'
                          : 'bg-slate-950/60 hover:bg-slate-800 border-white/10 hover:text-white'
                      }`}
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>{isSpeaking ? 'Stop Audio' : 'Read Aloud'}</span>
                    </button>

                    {prevUserMsg && !aiLoading && (
                      <button
                        type="button"
                        onClick={() => handleAskAIModel(prevUserMsg)}
                        className="flex items-center gap-1 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-white/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{m.content.includes('temporarily unavailable') ? 'Retry' : 'Regenerate'}</span>
                      </button>
                    )}
                  </div>

                  {isLatestAssistant && !aiLoading && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {roleProfile.followUpSuggestions.map((f, fIdx) => (
                        <button
                          key={fIdx}
                          type="button"
                          onClick={() => handleAskAIModel(f.prompt)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-[11px] font-medium text-indigo-200 transition-colors cursor-pointer"
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Active Processing Indicator */}
        {aiLoading && (
          <div className="p-3.5 bg-slate-900/90 text-indigo-200 border border-indigo-500/35 rounded-2xl text-xs max-w-[85%] mr-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ByteStatusAvatar state={assistantState} size="sm" />
              <div className="min-w-0">
                <span className="font-semibold text-white text-xs block">
                  {BYTE_STATE_LABELS[assistantState]}
                </span>
                <span className="text-[11px] text-slate-400 truncate block">
                  {aiStatusMessage ||
                    (aiReasoningMode
                      ? 'Synthesizing multi-step analysis…'
                      : 'Processing request and Veylentra scope…')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => aiAbortControllerRef.current?.abort()}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/35 text-rose-200 font-semibold text-[11px] shrink-0 cursor-pointer flex items-center gap-1"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          </div>
        )}
      </div>

      {/* Composer & Attachments Zone */}
      <div className="shrink-0 space-y-2 pt-1">
        {attachedFiles && attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 bg-slate-900/70 rounded-xl border border-white/10 max-h-[96px] overflow-y-auto">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 bg-indigo-950/50 text-xs text-indigo-200 px-2.5 py-1 rounded-lg border border-indigo-500/25"
              >
                <span className="truncate max-w-[140px] font-medium">{file.name}</span>
                <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachedFile(file.name)}
                  className="text-slate-400 hover:text-rose-400 cursor-pointer ml-1"
                  title="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          type="file"
          ref={aiFileInputRef}
          id="ai-file-uploader"
          onChange={handleFileUploadAction}
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
          className="hidden"
        />

        {aiUsageState.remaining <= 0 && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-xs">
                Daily quota exhausted (0/{aiUsageState.limit}). Next slot opens in ~{aiUsageState.nextAvailableInMinutes || 60}m.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowQuotaModal(true)}
              className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <Zap className="w-3 h-3" /> Upgrade
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              (window as any).__studentos_file_picker_active__ = true;
              aiFileInputRef.current?.click();
            }}
            className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-indigo-300 transition-colors shrink-0 cursor-pointer"
            title="Attach PDF, DOCX, PPTX, Image, or Notes"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={aiInput}
            onFocus={() => setIsComposerFocused(true)}
            onBlur={() => setIsComposerFocused(false)}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAskAIModel();
              }
            }}
            placeholder={
              aiUsageState.remaining <= 0
                ? 'Daily quota exhausted — click Boost to unlock more queries.'
                : attachedFiles && attachedFiles.length > 0
                  ? `Ask Byte about ${attachedFiles.map((f) => f.name).join(', ')}...`
                  : `Ask Byte (${roleProfile.displayLabel} Assistant) — equations, Veylentra insights, or lessons...`
            }
            disabled={aiLoading || aiUsageState.remaining <= 0}
            className={`flex-1 px-4 py-3 rounded-xl bg-slate-900 border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500 ${
              aiUsageState.remaining <= 0 ? 'border-rose-500/30 opacity-70 cursor-not-allowed' : 'border-white/10'
            }`}
          />

          {aiLoading ? (
            <button
              type="button"
              onClick={() => aiAbortControllerRef.current?.abort()}
              className="px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={aiUsageState.remaining <= 0 ? () => setShowQuotaModal(true) : () => handleAskAIModel()}
              disabled={aiUsageState.remaining > 0 && !aiInput.trim()}
              className={`px-4 sm:px-5 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-45 ${
                aiUsageState.remaining <= 0
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {aiUsageState.remaining <= 0 ? (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Boost</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
