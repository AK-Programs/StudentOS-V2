/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Byte AI Workspace — Complete Architectural Studio Redesign
 * - Collapsible desktop left session rail (with long-press context menu hooks preserved) + mobile drawer
 * - Clean 3-zone header + Preferences popover (Persona, Learning Mode, Deep Reasoning, Web Grounding, Super Admin Z.ai Provider selector)
 * - Editorial max-w-3xl dialogue stream with streaming-safe AcademicRichRenderer, inline Error + Retry, math widgets & flashcards
 * - Auto-growing multi-line textarea composer (Enter sends, Shift+Enter newline, >=44px touch targets)
 * - Zero window.prompt/alert, zero emoji UI chrome, full prefers-reduced-motion compliance
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  Code2,
  Compass,
  Copy,
  Cpu,
  Globe,
  HelpCircle,
  History,
  Layers,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Pin,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
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

const MODE_OPTIONS: Array<{
  id: 'explanatory' | 'socratic' | 'coder' | 'quiz_gen';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'explanatory', label: 'Explainer', icon: BookOpen },
  { id: 'socratic', label: 'Socratic', icon: HelpCircle },
  { id: 'coder', label: 'Coding', icon: Code2 },
  { id: 'quiz_gen', label: 'Quiz', icon: Compass }
];

const PROVIDER_DISPLAY: Record<string, string> = {
  auto: 'Auto Router',
  ministral: 'Ministral (ministral-8b-2410)',
  groq: 'Groq Rotation',
  zai: 'Z.ai (GLM-4.7 Flash)'
};

function isAssistantErrorContent(content?: string): boolean {
  const lower = (content || '').toLowerCase();
  return (
    lower.includes('ai is temporarily unavailable') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('request failed') ||
    lower.includes('unable to reach ai')
  );
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
  const isSuperAdmin = currentUser?.role === 'super_admin' || effectiveRole === 'super_admin';

  const [desktopRailOpen, setDesktopRailOpen] = useState(true);
  const [showPrefsPopover, setShowPrefsPopover] = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [showTeachTopicBar, setShowTeachTopicBar] = useState(false);
  const [teachTopicInput, setTeachTopicInput] = useState('');
  const [copiedMsgKey, setCopiedMsgKey] = useState<string | null>(null);
  const [recentFinishFlag, setRecentFinishFlag] = useState(false);

  const prevAiLoadingRef = useRef(aiLoading);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prefsRef = useRef<HTMLDivElement | null>(null);

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
      const hasError = isAssistantErrorContent(lastAssistantMsg?.content);
      if (!hasError && lastAssistantMsg?.content) {
        setRecentFinishFlag(true);
        const timer = setTimeout(() => setRecentFinishFlag(false), 3200);
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
    if (distanceFromBottom < 240 || aiLoading) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, lastAssistantMsg?.content?.length, aiLoading]);

  // Auto-grow composer textarea up to max-h-36 (144px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 144);
    el.style.height = `${Math.max(40, nextHeight)}px`;
  }, [aiInput]);

  // Close preferences popover on Escape or outside click
  useEffect(() => {
    if (!showPrefsPopover) return;
    const onPointerDown = (e: MouseEvent) => {
      if (prefsRef.current && !prefsRef.current.contains(e.target as Node)) {
        setShowPrefsPopover(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPrefsPopover(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showPrefsPopover]);

  const assistantState: ByteAssistantState = useMemo(() => {
    if (aiLoading) {
      const lowerStatus = (aiStatusMessage || '').toLowerCase();
      if (lowerStatus.includes('search') || lowerStatus.includes('source') || lowerStatus.includes('reading')) {
        return 'operating';
      }
      if (lastAssistantMsg?.content) {
        return 'generating';
      }
      return 'thinking';
    }
    if (isAssistantErrorContent(lastAssistantMsg?.content)) {
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

  const activePersonaObj = AI_PERSONAS.find((p) => p.id === selectedPersona) || AI_PERSONAS[0];
  const activeModeObj = MODE_OPTIONS.find((m) => m.id === aiMode) || MODE_OPTIONS[0];
  const quotaPct = Math.min(100, Math.round((aiUsageState.used / Math.max(1, aiUsageState.limit)) * 100));
  const hasUserMessages = messages.some((m) => m.role === 'user');

  const submitTeachTopic = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = teachTopicInput.trim();
    if (!clean) return;
    setSelectedTopicForTutor(clean);
    setTeachTopicInput('');
    setShowTeachTopicBar(false);
  };

  const selectThread = (t: any, closeMobileDrawer: boolean) => {
    if (byteThreadContext.shouldSuppressClick(t.id)) return;
    setActiveThreadId(t.id);
    if (t.attachedFiles) {
      setAttachedFiles(t.attachedFiles);
    } else if (t.attachedFile) {
      setAttachedFiles([t.attachedFile]);
    } else {
      setAttachedFiles([]);
    }
    if (closeMobileDrawer) {
      setShowAiHistoryDrawer(false);
    }
  };

  const renderSessionList = (closeMobileOnSelect: boolean) => (
    <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1">
      {aiThreads.length === 0 ? (
        <p className="text-center text-slate-500 text-xs py-8 px-2">No saved Byte sessions yet</p>
      ) : (
        aiThreads.map((t) => {
          const isHolding = byteThreadContext.holdingItemId === t.id;
          const isContextActive = aiThreadHoldMenu?.threadId === t.id;
          const persona = AI_PERSONAS.find((p) => p.id === t.personaId);
          const initialChar = (persona?.name || t.title || 'B').charAt(0).toUpperCase();
          return (
            <div
              key={t.id}
              {...byteThreadContext.getItemBindProps(t.id)}
              data-holding={isHolding ? 'true' : undefined}
              data-context-active={isContextActive ? 'true' : undefined}
              onClick={() => selectThread(t, closeMobileOnSelect)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectThread(t, closeMobileOnSelect);
                }
              }}
              className={`veylentra-context-target group flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-colors relative min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isHolding ? 'veylentra-context-holding' : ''
              } ${isContextActive ? 'veylentra-context-active' : ''} ${
                activeThreadId === t.id
                  ? 'border-indigo-500/70 bg-indigo-500/15'
                  : 'border-white/5 bg-slate-900/50 hover:bg-slate-900 hover:border-white/15'
              }`}
            >
              {t.isPinned && <Pin className="w-3 h-3 text-amber-400 absolute top-2 right-2" />}
              <div className="flex items-center gap-2.5 min-w-0 pr-3">
                <span className="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 text-indigo-300 font-semibold text-xs inline-flex items-center justify-center shrink-0">
                  {initialChar}
                </span>
                <div className="min-w-0">
                  <span className="text-xs text-slate-100 truncate font-semibold block leading-tight">
                    {t.title}
                  </span>
                  <span className="text-[11px] text-slate-400 capitalize flex items-center gap-1 mt-0.5">
                    <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{t.mode}</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="h-[calc(100dvh-130px)] flex rounded-3xl border border-white/10 bg-slate-950/90 shadow-xl relative w-full overflow-hidden">
      {/* Slide-out Mobile Session Drawer */}
      <AnimatePresence>
        {showAiHistoryDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : MOTION_DURATION.fast }}
              onClick={() => setShowAiHistoryDrawer(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 lg:hidden"
            />
            <motion.div
              initial={reduced ? { opacity: 0 } : { x: '-100%' }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: '-100%' }}
              transition={{ duration: reduced ? 0 : 0.24, ease: MOTION_EASE.easeOutExpo }}
              className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-slate-950/95 border-r border-white/10 z-50 p-4 flex flex-col shadow-2xl backdrop-blur-md lg:hidden"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-semibold text-sm text-white">Byte Sessions</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiHistoryDrawer(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
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
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Session</span>
                </button>
              </div>

              {renderSessionList(true)}

              <div className="pt-3 border-t border-white/10 text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{roleProfile.scopeBoundaryNote}</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Collapsible Desktop Left Session Rail */}
      {desktopRailOpen && (
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/10 bg-slate-950/80 p-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span>Sessions</span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">({aiThreads.length})</span>
            </span>
            <button
              type="button"
              onClick={() => {
                handleCreateNewThread();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Start new conversation"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          {renderSessionList(false)}

          <div className="pt-3 mt-2 border-t border-white/10 text-[11px] text-slate-400 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{roleProfile.scopeBoundaryNote}</span>
          </div>
        </aside>
      )}

      {/* Main Studio Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean 3-Zone Top Header */}
        <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-white/10 bg-slate-950/70 shrink-0">
          {/* Zone 1: Identity & Rail Toggle */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setDesktopRailOpen((v) => !v)}
              className="hidden lg:inline-flex items-center justify-center p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label={desktopRailOpen ? 'Collapse session rail' : 'Expand session rail'}
              title={desktopRailOpen ? 'Collapse session rail' : 'Expand session rail'}
            >
              {desktopRailOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setShowAiHistoryDrawer(true)}
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-medium transition-colors cursor-pointer shrink-0 min-h-[40px]"
              aria-label="Open session history"
            >
              <History className="w-4 h-4 text-indigo-400" />
              <span className="font-mono tabular-nums text-[11px]">{aiThreads.length}</span>
            </button>

            <ByteStatusAvatar state={assistantState} size="md" />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight whitespace-nowrap">Byte</h2>
                <span className="text-xs font-medium text-indigo-300 truncate">{roleProfile.displayLabel}</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                <span>{BYTE_STATE_LABELS[assistantState]}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{activePersonaObj?.name}</span>
              </p>
            </div>
          </div>

          {/* Zone 2 & 3: Focused Studio Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowTeachTopicBar((v) => !v)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
                showTeachTopicBar
                  ? 'bg-indigo-600/25 border-indigo-400/50 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 border-white/10 text-indigo-200'
              }`}
              title="Launch guided interactive topic lesson"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Teach Me Anything</span>
            </button>

            <button
              type="button"
              onClick={() => setIsJarvisActive(true)}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-500/35 text-sky-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[40px]"
              title="Open Orion Ephemeral Action Agent"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Orion Agent</span>
            </button>

            {/* Preferences Popover Anchor */}
            <div className="relative" ref={prefsRef}>
              <button
                type="button"
                onClick={() => setShowPrefsPopover((v) => !v)}
                aria-expanded={showPrefsPopover}
                className={`px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
                  showPrefsPopover
                    ? 'bg-indigo-600/20 border-indigo-400/50 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 border-white/10 text-slate-200'
                }`}
                title="Configure persona, mode, reasoning, web search & model routing"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline">Preferences</span>
              </button>

              <AnimatePresence>
                {showPrefsPopover && (
                  <motion.div
                    role="dialog"
                    aria-label="Byte workspace preferences"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: reduced ? 0 : 0.16, ease: MOTION_EASE.easeOutExpo }}
                    className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-white/15 bg-slate-950/98 shadow-2xl p-4 z-40 space-y-4 backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-xs font-semibold text-white">Studio Preferences</span>
                      <button
                        type="button"
                        onClick={() => setShowPrefsPopover(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                        aria-label="Close preferences"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Persona */}
                    <div className="space-y-1.5">
                      <label htmlFor="byte-persona-select" className="block text-[11px] font-medium text-slate-400">
                        Persona
                      </label>
                      <select
                        id="byte-persona-select"
                        value={selectedPersona}
                        onChange={(e) => handleSwitchPersona(e.target.value)}
                        className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                      >
                        {AI_PERSONAS.map((p) => (
                          <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                            {p.name} ({p.speciality})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Learning Mode Segmented Buttons */}
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-medium text-slate-400">Response Mode</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {MODE_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          const active = aiMode === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleSwitchMode(opt.id)}
                              className={`px-2.5 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                                active
                                  ? 'bg-indigo-600/25 border-indigo-400/50 text-white'
                                  : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0 text-indigo-300" />
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Deep Reasoning Toggle */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div>
                        <span className="text-xs font-medium text-slate-200 block">Deep Reasoning</span>
                        <span className="text-[11px] text-slate-400 block">Multi-step verification</span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={aiReasoningMode}
                        onClick={() => setAiReasoningMode(!aiReasoningMode)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          aiReasoningMode
                            ? 'bg-violet-500/25 border-violet-400/50 text-violet-100'
                            : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        <span>{aiReasoningMode ? 'On' : 'Off'}</span>
                      </button>
                    </div>

                    {/* Web Grounding Mode */}
                    <div className="space-y-1.5">
                      <label htmlFor="byte-web-select" className="block text-[11px] font-medium text-slate-400">
                        Web Search Grounding
                      </label>
                      <select
                        id="byte-web-select"
                        value={aiWebSearchMode}
                        onChange={(e) => setAiWebSearchMode(e.target.value as 'auto' | 'force' | 'off')}
                        className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-teal-200 focus:outline-none focus:border-teal-400 cursor-pointer"
                      >
                        <option value="auto" className="bg-slate-900 text-white">
                          Auto (Smart Detection)
                        </option>
                        <option value="force" className="bg-slate-900 text-white">
                          Always Ground Online
                        </option>
                        <option value="off" className="bg-slate-900 text-white">
                          Off (Local & Veylentra Only)
                        </option>
                      </select>
                    </div>

                    {/* Super Admin Provider Override (including Z.ai GLM-4.7 Flash) */}
                    {isSuperAdmin && (
                      <div className="space-y-1.5 pt-2 border-t border-white/10">
                        <label htmlFor="byte-provider-select" className="block text-[11px] font-medium text-indigo-300">
                          Super Admin Provider Override
                        </label>
                        <select
                          id="byte-provider-select"
                          value={aiModelOverride || 'auto'}
                          onChange={(e) => setAiModelOverride(e.target.value === 'auto' ? '' : e.target.value)}
                          className="w-full rounded-xl bg-slate-900 border border-indigo-500/40 px-3 py-2 text-xs text-indigo-100 focus:outline-none focus:border-indigo-400 cursor-pointer"
                        >
                          <option value="auto" className="bg-slate-900 text-white">
                            Auto Router
                          </option>
                          <option value="ministral" className="bg-slate-900 text-white">
                            Ministral (ministral-8b-2410)
                          </option>
                          <option value="groq" className="bg-slate-900 text-white">
                            Groq Rotation
                          </option>
                          <option value="zai" className="bg-slate-900 text-white">
                            Z.ai (GLM-4.7 Flash)
                          </option>
                        </select>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quota Trigger */}
            <button
              type="button"
              onClick={() => setShowQuotaModal(true)}
              className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 min-h-[40px]"
              title="View or boost daily Byte AI quota"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className={`font-mono font-bold tabular-nums ${aiUsageState.remaining <= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {aiUsageState.remaining}
              </span>
              <span className="text-slate-500 font-mono text-[11px] tabular-nums hidden sm:inline">
                /{aiUsageState.limit}
              </span>
              <span className="w-8 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden xl:block">
                <span
                  className={`block h-full rounded-full transition-all duration-300 ${
                    aiUsageState.remaining <= 0 ? 'bg-rose-500' : quotaPct > 80 ? 'bg-amber-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${quotaPct}%` }}
                />
              </span>
            </button>

            <button
              type="button"
              onClick={handleClearThreadHistory}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Clear messages in active session"
              aria-label="Clear active session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Subtle Unboxed Studio Configuration Line & Inline Teach Me Anything Bar */}
        <div className="px-4 sm:px-6 py-2 border-b border-white/5 bg-slate-950/40 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 text-[11px] text-slate-400 flex-wrap">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span>Mode: {activeModeObj.label}</span>
              <span aria-hidden="true">·</span>
              <span>Reasoning: {aiReasoningMode ? 'Deep' : 'Standard'}</span>
              <span aria-hidden="true">·</span>
              <span>
                Web: {aiWebSearchMode === 'force' ? 'Always' : aiWebSearchMode === 'off' ? 'Off' : 'Auto'}
              </span>
              {isSuperAdmin && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-indigo-300">
                    Router: {PROVIDER_DISPLAY[aiModelOverride || 'auto'] || aiModelOverride}
                  </span>
                </>
              )}
            </div>
            <span className="text-slate-500 hidden sm:inline">Tab context: {activeTab}</span>
          </div>

          <AnimatePresence>
            {showTeachTopicBar && (
              <motion.form
                onSubmit={submitTeachTopic}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: reduced ? 0 : MOTION_DURATION.fast }}
                className="max-w-3xl mx-auto mt-2.5 p-2 rounded-2xl bg-slate-900 border border-indigo-500/35 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={teachTopicInput}
                  onChange={(e) => setTeachTopicInput(e.target.value)}
                  placeholder="Enter any topic for an interactive Byte lesson (e.g. Thermodynamics, Matrix Inverse)..."
                  autoFocus
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 min-h-[40px]"
                />
                <button
                  type="submit"
                  disabled={!teachTopicInput.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer min-h-[40px] whitespace-nowrap"
                >
                  Start Lesson
                </button>
                <button
                  type="button"
                  onClick={() => setShowTeachTopicBar(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                  aria-label="Cancel interactive topic"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Editorial Dialogue Stream */}
        <div
          id="ai-dialog-scroll"
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5"
        >
          <div className="max-w-3xl mx-auto w-full space-y-5">
            {/* Empty State: Role-Aware Welcome Canvas */}
            {!hasUserMessages && (
              <motion.div
                initial={reduced ? undefined : { opacity: 0, y: 8 }}
                animate={reduced ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0 : MOTION_DURATION.normal, ease: MOTION_EASE.easeOutExpo }}
                className="py-4 sm:py-6 space-y-6"
              >
                <div className="text-center space-y-2.5">
                  <div className="flex justify-center">
                    <ByteStatusAvatar state={assistantState} size="lg" />
                  </div>
                  <h3
                    className="text-xl sm:text-2xl font-bold text-white tracking-tight"
                    style={{ textWrap: 'balance' } as React.CSSProperties}
                  >
                    Hello, {currentUser?.name || roleProfile.displayLabel}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                    {roleProfile.capabilitiesSummary}
                  </p>
                  <div className="text-xs text-slate-400 flex items-center justify-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <ShieldCheck className="w-3.5 h-3.5" /> {roleProfile.displayLabel} Scope
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>LaTeX Math &amp; Chemistry Ready</span>
                  </div>
                </div>

                {/* Role-Tailored Starter Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roleProfile.starterPrompts.map((item, idx) => (
                    <motion.button
                      key={idx}
                      type="button"
                      whileHover={reduced ? undefined : { y: -2 }}
                      transition={{ duration: 0.16 }}
                      onClick={() => handleAskAIModel(item.prompt)}
                      className="p-4 rounded-2xl bg-slate-900/75 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/45 text-left transition-colors cursor-pointer flex flex-col justify-between gap-2 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-indigo-300">
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

                {/* Quick Authorized Veylentra Module Shortcuts */}
                {roleProfile.modules.length > 0 && (
                  <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">Jump to module:</span>
                    {roleProfile.modules.map((mod) => (
                      <button
                        key={mod.tabId}
                        type="button"
                        onClick={() => onNavigateTab(mod.tabId)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900/75 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                        title={mod.description}
                      >
                        {mod.label}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Dialogue Messages */}
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
              const msgIsError = m.role === 'assistant' && !isActivelyStreamingMsg && isAssistantErrorContent(m.content);

              if (isActivelyStreamingMsg && !m.content) {
                return null;
              }

              if (m.role === 'user') {
                return (
                  <motion.div
                    key={msgKey}
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={reduced ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: reduced ? 0 : 0.18, ease: MOTION_EASE.easeOutExpo }}
                    className="ml-auto max-w-[85%] sm:max-w-[75%] rounded-2xl bg-indigo-600/20 border border-indigo-500/35 px-4 py-3 text-white overflow-hidden"
                  >
                    <div className="text-[11px] font-semibold text-indigo-300 mb-1">
                      {roleProfile.displayLabel}
                    </div>
                    <AcademicRichRenderer content={m.content} isStreaming={false} compact={false} />
                    {m.files && m.files.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                        {m.files.map((file: any, fIdx: number) => (
                          <div
                            key={fIdx}
                            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-white/10 text-[11px]"
                          >
                            <span className="font-medium text-slate-200 truncate max-w-[150px]">{file.name}</span>
                            <span className="text-slate-400 font-mono text-[10px] tabular-nums">
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msgKey}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={reduced ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: reduced ? 0 : 0.18, ease: MOTION_EASE.easeOutExpo }}
                  className={`w-full rounded-2xl border p-4 sm:p-5 text-slate-100 overflow-hidden ${
                    msgIsError
                      ? 'bg-rose-950/20 border-rose-500/35'
                      : 'bg-slate-900/65 border-white/10'
                  }`}
                >
                  {/* Clean unboxed single header line */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5 text-[11px] text-slate-400">
                    <span className="font-semibold text-indigo-300">Byte</span>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
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
                          {(m.webSearchUsed || aiGroundedInData) && <span aria-hidden="true">·</span>}
                          <span>{aiActiveModelLabel.split('/').pop()}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline Error Callout + Highlighted Retry */}
                  {msgIsError ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2.5 text-rose-200">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-rose-300 block">Response Unavailable</span>
                          <p className="text-xs text-slate-200 leading-relaxed">{m.content}</p>
                        </div>
                      </div>
                      {prevUserMsg && !aiLoading && (
                        <button
                          type="button"
                          onClick={() => handleAskAIModel(prevUserMsg)}
                          className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry Prompt</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <AcademicRichRenderer
                      content={m.content}
                      isStreaming={isActivelyStreamingMsg}
                      compact={false}
                    />
                  )}

                  {isActivelyStreamingMsg && (
                    <span
                      className="inline-block w-2 h-3.5 mt-1 bg-indigo-400 animate-pulse rounded-xs align-middle"
                      aria-label="Streaming response"
                    />
                  )}

                  {(m.truncated || m.finishReason === 'length') && !isActivelyStreamingMsg && !msgIsError && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-950/30 border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2 text-xs text-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>Response reached the model output length limit and may be incomplete.</span>
                      </div>
                      {!aiLoading && (
                        <button
                          type="button"
                          onClick={() =>
                            handleAskAIModel(
                              'Continue the previous explanation seamlessly from exactly where it stopped without repeating prior sections.'
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                        >
                          Continue explanation
                        </button>
                      )}
                    </div>
                  )}

                  {mathWidget && <InteractiveMathWidget widgetType={mathWidget} />}

                  {detectedTopic && !isActivelyStreamingMsg && !msgIsError && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-950/75 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <span className="text-[11px] font-semibold text-indigo-300 block">
                          Byte Interactive Classroom
                        </span>
                        <p className="text-xs font-semibold text-white mt-0.5">
                          Explore &ldquo;{detectedTopic}&rdquo; with step-by-step checkpoints
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedTopicForTutor(detectedTopic)}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shrink-0 cursor-pointer transition-colors"
                      >
                        Launch Lesson
                      </button>
                    </div>
                  )}

                  {m.webSources && m.webSources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                      <span className="text-[11px] font-medium text-teal-300 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" /> Verified Sources ({m.webSources.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {m.webSources.map((src: any, sIdx: number) => (
                          <a
                            key={sIdx}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-white/10 hover:border-teal-500/40 transition-colors text-left"
                          >
                            <span className="text-teal-300 font-mono text-[11px] font-bold shrink-0 tabular-nums">
                              [{sIdx + 1}]
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-200 group-hover:text-teal-300 truncate">
                                {src.title}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 truncate">
                                {src.domain}
                                {src.sourceType === 'academic' ? ' · Academic' : ''}
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

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

                  {m.content && !isActivelyStreamingMsg && !msgIsError && (
                    <div className="mt-3.5 pt-3 border-t border-white/10 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
                        <button
                          type="button"
                          onClick={() => {
                            handleCopyToClipboard(m.content);
                            setCopiedMsgKey(msgKey);
                            setTimeout(() => setCopiedMsgKey(null), 1600);
                          }}
                          className="flex items-center gap-1.5 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-white/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          {copiedMsgKey === msgKey ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedMsgKey === msgKey ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveToNotes(m.content)}
                          className="flex items-center gap-1.5 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-white/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
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
                          className="flex items-center gap-1.5 hover:text-white bg-slate-950/60 hover:bg-indigo-500/20 border border-white/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Save Flashcards</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleSpeakMessage(m.content, msgKey)}
                          className={`flex items-center gap-1.5 border px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                            isSpeaking
                              ? 'text-rose-300 border-rose-500/35 bg-rose-500/15'
                              : 'bg-slate-950/60 hover:bg-slate-800 border-white/10 hover:text-white'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{isSpeaking ? 'Stop Audio' : 'Read Aloud'}</span>
                        </button>

                        {prevUserMsg && !aiLoading && (
                          <button
                            type="button"
                            onClick={() => handleAskAIModel(prevUserMsg)}
                            className="flex items-center gap-1.5 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-white/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Regenerate</span>
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
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-xs font-medium text-indigo-200 transition-colors cursor-pointer"
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
              <div className="p-3.5 bg-slate-900/90 text-indigo-200 border border-indigo-500/35 rounded-2xl text-xs w-full flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ByteStatusAvatar state={assistantState} size="sm" />
                  <div className="min-w-0">
                    <span className="font-semibold text-white text-xs block">
                      {BYTE_STATE_LABELS[assistantState]}
                    </span>
                    <span className="text-xs text-slate-400 truncate block">
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
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/35 text-rose-200 font-semibold text-xs shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Ergonomic Docked Bottom Composer */}
        <div className="shrink-0 border-t border-white/10 bg-slate-950/75 px-4 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto w-full space-y-2">
            {attachedFiles && attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-slate-900/80 rounded-xl border border-white/10 max-h-[88px] overflow-y-auto">
                {attachedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 bg-indigo-950/55 text-xs text-indigo-200 px-2.5 py-1 rounded-lg border border-indigo-500/25"
                  >
                    <span className="truncate max-w-[150px] font-medium">{file.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachedFile(file.name)}
                      className="text-slate-400 hover:text-rose-400 cursor-pointer ml-1"
                      title="Remove attachment"
                      aria-label={`Remove ${file.name}`}
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
                    Daily quota exhausted (<span className="font-mono tabular-nums">0/{aiUsageState.limit}</span>). Next slot in ~
                    <span className="font-mono tabular-nums">{aiUsageState.nextAvailableInMinutes || 60}m</span>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuotaModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Upgrade</span>
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-slate-900/90 focus-within:border-indigo-400/60 p-1.5 flex items-end gap-2 transition-colors">
              <button
                type="button"
                onClick={() => {
                  (window as any).__studentos_file_picker_active__ = true;
                  aiFileInputRef.current?.click();
                }}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-indigo-300 transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                title="Attach PDF, DOCX, PPTX, Image, or Notes"
                aria-label="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
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
                    ? 'Daily quota exhausted — boost to unlock more queries.'
                    : attachedFiles && attachedFiles.length > 0
                      ? `Ask Byte about ${attachedFiles.map((f) => f.name).join(', ')}...`
                      : `Ask Byte (${roleProfile.displayLabel} Assistant) — Shift+Enter for new line...`
                }
                disabled={aiLoading || aiUsageState.remaining <= 0}
                className={`flex-1 bg-transparent px-2.5 py-2.5 text-sm leading-relaxed resize-none max-h-36 focus:outline-none text-white placeholder-slate-500 ${
                  aiUsageState.remaining <= 0 ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />

              {aiLoading ? (
                <button
                  type="button"
                  onClick={() => aiAbortControllerRef.current?.abort()}
                  className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={aiUsageState.remaining <= 0 ? () => setShowQuotaModal(true) : () => handleAskAIModel()}
                  disabled={aiUsageState.remaining > 0 && !aiInput.trim()}
                  className={`min-h-[44px] px-4 sm:px-5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-45 ${
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
      </div>
    </div>
  );
};
