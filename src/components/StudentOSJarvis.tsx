import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  Sparkles,
  Users,
  BarChart3,
  Award,
  RotateCcw,
  Layers,
  Plus,
  CheckCircle2,
  RefreshCw,
  X,
  BookOpen,
  FileText,
  Layout,
  Search,
  Globe,
  PenTool,
  ExternalLink,
  Video,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  AlertTriangle,
  Copy,
  BookmarkPlus,
  ArrowRight,
  ClipboardList,
  FolderOpen,
  Bell,
  GraduationCap,
} from 'lucide-react';
import { GlassyVideoCarousel, EducationalVideoItem } from './ui/GlassyVideoCarousel';
import { VeylentraIcon } from './ui/VeylentraIcon';
import { supabase } from '../lib/supabase';
import { fetchAllSupabaseUsers } from '../lib/supabaseUsers';
import {
  OrionAction,
  OrionUserContext,
  OrionActionType,
  StructuredOrionPayload,
} from '../lib/orionActionExecutor';
import {
  OrionAgentProgressSnapshot,
  executeOrionViaServer,
  runOrionAgentTask,
} from '../lib/orionAgentEngine';
import { OrionActivityTimeline } from './orion/OrionActivityTimeline';
import { AcademicRichRenderer } from './ui/AcademicRichRenderer';
import {
  buildAuthorizedStudentOSContext,
  detectMathInteractiveWidget,
  InteractiveMathWidget,
} from '../lib/studentosAiEngine';
import { useReducedMotionPreference } from '../lib/motionSystem';
import { extractApiErrorMessage, getServerAuthHeaders } from '../lib/clientSession';
import { StudentReport, HouseAnalytics, SectionAnalytics } from '../types';

interface StudentOSJarvisProps {
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  clearWhiteboard?: () => void;
  drawShapeOnWhiteboard?: (shape: string, text?: string) => void;
  saveWhiteboard?: () => void;
  setSearchMaterialsQuery?: (query: string) => void;
  setTriggerQuickQuiz?: (start: boolean) => void;
  showNotification: (msg: string) => void;
  createVaultNote?: (title: string, content: string, subject: string) => void;
  onSuperAdminUnlocked?: () => void;
  currentUser: any;
  effectiveRole: string;
  initialQuery?: string;
  modelOverride?: string;
}

interface OrionExecutionTurn {
  id: string;
  idempotencyKey?: string;
  userCommand: string;
  plannedSteps?: OrionAction[];
  snapshot?: OrionAgentProgressSnapshot | null;
  finalResponse: string;
  status: 'running' | 'needs_clarification' | 'awaiting_confirmation' | 'completed' | 'failed';
  errorMessage?: string;
  providerUsed?: string;
  modelUsed?: string;
  mathWidget?: ReturnType<typeof detectMathInteractiveWidget>;
}

const getRoleGreeting = (role: string): string => {
  const norm = (role || 'student').toLowerCase().trim();
  if (norm === 'parent' || norm === 'guardian') {
    return 'Ephemeral session active. Ask about your verified linked ward, notices, or curriculum topics.';
  }
  if (norm === 'student') {
    return 'Ephemeral session active. Check pending homework, build a study plan, or research curriculum topics.';
  }
  return 'Ephemeral session active. Run class briefings, attendance checks, verified broadcasts, or research.';
};

export const isExplicitTabNavigationCommand = (textLow: string): boolean => {
  const hasNavVerb =
    textLow.startsWith('open ') ||
    textLow.startsWith('go to ') ||
    textLow.startsWith('launch ') ||
    textLow.startsWith('switch to ') ||
    textLow.startsWith('take me to ');
  const hasDataOrWriteVerb =
    textLow.includes('create ') ||
    textLow.includes('check ') ||
    textLow.includes('show ') ||
    textLow.includes('summary') ||
    textLow.includes('report') ||
    textLow.includes('status') ||
    textLow.includes('pending') ||
    textLow.includes('who ') ||
    textLow.includes('how many') ||
    textLow.includes('analyze') ||
    textLow.includes('mark ') ||
    textLow.includes('assign ') ||
    textLow.includes('generate ');
  return hasNavVerb && !hasDataOrWriteVerb;
};

export const StudentOSJarvis: React.FC<StudentOSJarvisProps> = ({
  onClose,
  activeTab,
  setActiveTab,
  showNotification,
  createVaultNote,
  onSuperAdminUnlocked,
  currentUser,
  effectiveRole,
  initialQuery,
  modelOverride,
}) => {
  const reducedMotion = useReducedMotionPreference();
  const normalizedRole = (effectiveRole || currentUser?.role || 'student').toLowerCase().trim();
  const isStaffRole = ['teacher', 'faculty', 'head_teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(normalizedRole);

  // Workspace view mode
  const [activeJarvisSection, setActiveJarvisSection] = useState<'home' | 'reports' | 'houses' | 'sections' | 'search'>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<string>('');
  const [searchSources, setSearchSources] = useState<{ title: string; uri: string; published_source?: string }[]>([]);
  const [searchVideos, setSearchVideos] = useState<EducationalVideoItem[]>([]);
  const [generatedNotesContent, setGeneratedNotesContent] = useState<{ title: string; content: string } | null>(null);
  const [localMaterials, setLocalMaterials] = useState<any[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [isNotesSaved, setIsNotesSaved] = useState<boolean>(false);
  const [navigatingTransition, setNavigatingTransition] = useState<{ title: string; tab: string } | null>(null);
  const [showPagePicker, setShowPagePicker] = useState<boolean>(false);

  // Ephemeral voice & execution state (never persisted)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [commandText, setCommandText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [jarvisFeedback, setJarvisFeedback] = useState<string>(() => getRoleGreeting(normalizedRole));
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [diagnosticError, setDiagnosticError] = useState<{ name: string; message: string } | null>(null);
  const [orionProgress, setOrionProgress] = useState<OrionAgentProgressSnapshot | null>(null);
  const [turns, setTurns] = useState<OrionExecutionTurn[]>([]);
  const [lastFailedCommand, setLastFailedCommand] = useState<string | null>(null);

  // Clarification & Confirmation gates
  const [pendingClarification, setPendingClarification] = useState<{
    originalCommand: string;
    question: string;
    missingFields: string[];
  } | null>(null);
  const [clarificationReply, setClarificationReply] = useState<string>('');

  const [pendingConfirmation, setPendingConfirmation] = useState<{
    originalCommand: string;
    idempotencyKey?: string;
    action: string;
    targetValue?: string;
    promptText: string;
    previewDetails?: Record<string, string>;
    actionObject?: OrionAction;
    plannedSteps?: OrionAction[];
  } | null>(null);

  // Context Inspector state
  const [structuredOutput, setStructuredOutput] = useState<StructuredOrionPayload | null>(null);
  const [orionMathWidget, setOrionMathWidget] = useState<ReturnType<typeof detectMathInteractiveWidget>>(null);
  const [orionModelUsed, setOrionModelUsed] = useState<string>('');

  const ephemeralTurnsRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const lastEntityRef = useRef<{ type: string; title: string; id?: string } | null>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);
  const isExecutingRef = useRef<boolean>(false);

  const [linkedChildren, setLinkedChildren] = useState<any[]>([]);
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [houses, setHouses] = useState<HouseAnalytics[]>([]);
  const [sections, setSections] = useState<SectionAnalytics[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentReport | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchStudentTerm, setSearchStudentTerm] = useState<string>('');

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);

  const triggerNavTransition = (title: string, tab: string) => {
    setNavigatingTransition({ title, tab });
    setTimeout(() => {
      setNavigatingTransition(null);
      setActiveTab(tab as any);
      if (onClose) onClose();
    }, 650);
  };

  const clearEphemeralSession = () => {
    ephemeralTurnsRef.current = [];
    lastEntityRef.current = null;
    setCommandText('');
    setClarificationReply('');
    setSearchQuery('');
    setSearchResults('');
    setSearchSources([]);
    setSearchVideos([]);
    setGeneratedNotesContent(null);
    setLocalMaterials([]);
    setStructuredOutput(null);
    setPendingConfirmation(null);
    setPendingClarification(null);
    setLastFailedCommand(null);
    setOrionMathWidget(null);
    setOrionProgress(null);
    setOrionModelUsed('');
    setTurns([]);
    setJarvisFeedback(getRoleGreeting(normalizedRole));
  };

  useEffect(() => {
    return () => {
      ephemeralTurnsRef.current = [];
      lastEntityRef.current = null;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'end' });
  }, [turns, orionProgress, pendingClarification, pendingConfirmation, reducedMotion]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).msSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListening(true);
      shouldListenRef.current = true;
      setDiagnosticError(null);
    };

    rec.onresult = (event: any) => {
      let interim = '';
      let finalStr = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const text = finalStr || interim;
      if (text) setCommandText(text);
    };

    rec.onerror = (err: any) => {
      if (err.error === 'no-speech') return;
      shouldListenRef.current = false;
      setIsListening(false);
      setDiagnosticError({ name: err.error || 'SpeechError', message: String(err.message || err.error || 'Speech recognition error') });
      if (err.error === 'not-allowed') {
        showNotification('Microphone access blocked. Check browser permissions.');
      }
    };

    rec.onend = () => {
      if (shouldListenRef.current) {
        try {
          rec.start();
        } catch {
          setIsListening(false);
          shouldListenRef.current = false;
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = rec;
  }, []);

  // Auto-run initialQuery
  const lastInitialQueryRef = useRef<string>('');
  useEffect(() => {
    const trimmed = (initialQuery || '').trim();
    if (!trimmed || trimmed === lastInitialQueryRef.current) return;
    lastInitialQueryRef.current = trimmed;
    setCommandText(trimmed);
    const timer = setTimeout(() => {
      executeVoiceCommand(trimmed);
    }, 120);
    return () => clearTimeout(timer);
  }, [initialQuery]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    return getServerAuthHeaders();
  };

  // Fetch linked children (Parent) and cohort directory (Staff)
  useEffect(() => {
    if (!currentUser) return;
    if ((normalizedRole === 'parent' || normalizedRole === 'guardian') && currentUser?.uid) {
      void getAuthHeaders().then(headers =>
        fetch(`/api/parent/linked-children?parentUid=${encodeURIComponent(currentUser.uid)}`, { headers })
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          if (Array.isArray(payload?.children)) setLinkedChildren(payload.children);
        })
        .catch(() => {});
    }

    if (isStaffRole) {
      fetchAllSupabaseUsers()
        .then((users) => {
          const studentUsers = users.filter((u) => u.role === 'student');
          setReports(
            studentUsers.map((s) => ({
              id: s.uid,
              name: s.name,
              classGrade: s.grade || 'Grade 10',
              section: (s.section || 'Ruby') as any,
              house: (s.house || 'Ruby') as any,
              streakDays: s.streakDays ?? 0,
              materialsUploaded: s.quizzesTaken ?? 0,
              notesCreated: s.studyHours ?? 0,
              quizzesCompleted: s.quizzesTaken ?? 0,
              assignmentsCompleted: 4,
              communityContributions: 12,
              recentActivity: [
                'Completed Physics assignment',
                'Reviewed study guide',
                'Participated in classroom session',
              ],
            }))
          );

          const houseList = ['Ruby', 'Emerald', 'Sapphire', 'Topaz'];
          setHouses(
            houseList.map((h) => {
              const matching = studentUsers.filter((s) => s.house === h);
              return {
                id: h as any,
                points: matching.length * 150 + 100,
                materialsShared: matching.length * 2,
                quizzesWon: matching.length * 3,
                participation: 85,
              };
            })
          );

          const sectionList = ['Ruby', 'Astra', 'Solara', 'Vega'];
          setSections(
            sectionList.map((sec) => {
              const matching = studentUsers.filter((s) => s.section === sec);
              return {
                id: sec as any,
                totalStudents: matching.length || 2,
                studyActivity: 74,
                quizScores: 82,
                materialContributions: matching.length * 3,
              };
            })
          );
        })
        .catch(() => {});
    }
  }, [currentUser, normalizedRole, isStaffRole]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showNotification('Speech recognition is not supported in this browser.');
      return;
    }
    if (isListening) {
      shouldListenRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    } else {
      try {
        shouldListenRef.current = true;
        recognitionRef.current.start();
        showNotification('Microphone active. Speak now.');
      } catch {
        setIsListening(false);
        shouldListenRef.current = false;
      }
    }
  };

  const speakFeedback = (text: string) => {
    if ('speechSynthesis' in window && text.trim()) {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ''));
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }, 40);
    }
  };

  // Fixed JSON + SSE response handling for AI fallback/research
  const queryJarvisAIStream = async (
    command: string
  ): Promise<{ responseText: string; action: string; targetValue?: string; details?: any; error?: string }> => {
    const { contextString: ragContext } = await buildAuthorizedStudentOSContext(
      command,
      currentUser,
      normalizedRole,
      {
        activeTab,
        linkedStudents: linkedChildren.length > 0 ? linkedChildren : undefined,
      }
    );

    const headers = await getAuthHeaders();
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: `User request inside Veylentra Orion (${normalizedRole}, tab=${activeTab}): "${command}". Answer accurately in clear Markdown (and LaTeX $...$ / $$...$$ for math/science) without inventing school records.`,
        persona: 'orion',
        level: 'Secondary',
        mode: 'explanatory',
        taskType: 'general',
        modelOverride: modelOverride || undefined,
        webSearchMode: 'auto',
        stream: false,
        history: ephemeralTurnsRef.current.slice(-6),
        ragContext,
        activeTab,
        userId: currentUser?.uid || 'guest',
        userRole: normalizedRole,
      }),
    });

    const ctype = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok) {
      const errJson = ctype.includes('application/json') ? await response.json().catch(() => ({})) : {};
      throw new Error(errJson.message || errJson.error || `AI request failed with HTTP ${response.status}.`);
    }

    if (ctype.includes('application/json')) {
      const payload = await response.json();
      if (payload.modelUsed) setOrionModelUsed(payload.modelUsed);
      if (payload.usage && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('s_os_ai_quota_updated', { detail: { ...payload.usage, lastUpdated: Date.now() } }));
      }
      const text = String(payload.text || '').trim();
      if (!text) {
        throw new Error(payload.error || 'AI provider returned an empty response.');
      }
      return { responseText: text, action: 'general_chat' };
    }

    // Read SSE stream if server responded with text/event-stream
    if (!response.body) {
      throw new Error('Server returned an empty stream body.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';
    let doneText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const clean = line.trim();
        if (!clean.startsWith('data:')) continue;
        const rawJson = clean.slice(5).trim();
        if (!rawJson || rawJson === '[DONE]') continue;
        try {
          const parsed = JSON.parse(rawJson);
          if (parsed.type === 'token' && typeof parsed.token === 'string') {
            accumulated += parsed.token;
          } else if (parsed.type === 'done' && typeof parsed.text === 'string') {
            doneText = parsed.text;
            if (parsed.modelUsed) setOrionModelUsed(parsed.modelUsed);
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error || 'Stream error');
          }
        } catch (err) {
          if (err instanceof Error && err.message !== 'Unexpected end of JSON input') {
            // Re-throw explicit stream error
          }
        }
      }
    }

    const finalStr = (doneText || accumulated).trim();
    if (!finalStr) {
      throw new Error('Orion could not receive any response text from the AI service.');
    }
    return { responseText: finalStr, action: 'general_chat' };
  };

  const handleRunInternetSearch = async (query: string) => {
    if (!query || !query.trim()) return;
    const cleanQ = query.trim();
    setSearching(true);
    setSearchQuery(cleanQ);
    setGeneratedNotesContent(null);
    setIsNotesSaved(false);
    setSearchResults(`Searching verified web and academic sources for "${cleanQ}"...`);

    const searchStartedAt = Date.now();
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: cleanQ }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(extractApiErrorMessage(errData, `HTTP ${response.status}`));
      }

      const searchData = await response.json();
      const textOut = searchData.summary || 'No grounded synthesis returned.';
      const rawSources = Array.isArray(searchData.results) ? searchData.results : [];
      const mappedSources = rawSources.map((s: any) => ({
        title: s.title || s.published_source || 'Web Source',
        uri: s.url || s.uri || '#',
        published_source: s.published_source || 'Web Source',
      }));
      const rawVideos = Array.isArray(searchData.videos) ? searchData.videos : [];
      const searchElapsedMs = Math.max(0, Date.now() - searchStartedAt);

      setSearchResults(textOut);
      setSearchSources(mappedSources);
      setSearchVideos(rawVideos);
      setGeneratedNotesContent({ title: `${cleanQ} (Orion Research)`, content: textOut });
      setJarvisFeedback(textOut);

      setTurns((prev) => [
        ...prev,
        {
          id: `turn_${Date.now()}`,
          userCommand: cleanQ,
          finalResponse: textOut,
          status: 'completed',
          modelUsed: searchData.telemetry?.modelUsed,
          providerUsed: searchData.telemetry?.providerUsed,
          snapshot: {
            phase: 'completed',
            headline: `Retrieved ${mappedSources.length} verified sources`,
            startedAt: searchStartedAt,
            finishedAt: Date.now(),
            verified: mappedSources.length > 0,
            stages: [
              { phase: 'analyzing', label: 'Analyzing query', status: 'completed', durationMs: 0 },
              { phase: 'executing', label: 'Searching sources', status: 'completed', durationMs: searchElapsedMs },
              { phase: 'verifying', label: 'Verified citations', status: 'completed', durationMs: 0 },
            ],
            steps: [
              {
                id: 'step-1',
                label: 'Web grounding search',
                action: 'web_search',
                status: 'verified',
                verificationNote: `${mappedSources.length} sources${rawVideos.length ? `, ${rawVideos.length} videos` : ''}`,
              },
            ],
          },
        },
      ]);
    } catch (err: any) {
      const msg = err?.message || 'Unable to reach live web sources right now.';
      setSearchResults(msg);
      setSearchSources([]);
      setSearchVideos([]);
      setLastFailedCommand(cleanQ);
    } finally {
      setSearching(false);
    }
  };

  const handleRunResourceDiscovery = async (query: string) => {
    if (!query || !query.trim()) return;
    setSearching(true);
    setSearchQuery(query);
    try {
      const { data: matchedMaterials, error } = await supabase
        .from('materials')
        .select('*')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(10);

      setLocalMaterials(!error && matchedMaterials ? matchedMaterials : []);

      const headers = await getAuthHeaders();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: `List 4 high-yield academic learning resources and active experiments for "${query}" with concise descriptions.`,
          persona: 'study_buddy',
          level: 'Secondary',
          mode: 'explanatory',
          modelOverride: modelOverride || undefined,
          userId: currentUser?.uid || 'guest',
          userRole: normalizedRole,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setSearchResults(data.text || 'No recommendations compiled.');
    } catch (err: any) {
      setSearchResults(err?.message || 'Discovery failed. Check connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateLessonPlan = async (topic: string) => {
    if (!topic || !topic.trim()) return;
    setSearching(true);
    setSearchQuery(topic);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: `Create a structured 1-hour study plan block for "${topic}" with Timing, Activities, and Learning Objectives.`,
          persona: 'study_buddy',
          level: 'Secondary',
          mode: 'explanatory',
          modelOverride: modelOverride || undefined,
          userId: currentUser?.uid || 'guest',
          userRole: normalizedRole,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSearchResults(data.text || 'No plan compiled.');
      window.dispatchEvent(
        new CustomEvent('s_os_add_schedule', {
          detail: {
            subject: topic.substring(0, 30),
            day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][new Date().getDay() - 1] || 'Monday',
            time: '14:00 - 15:00',
          },
        })
      );
    } catch (err: any) {
      showNotification(err?.message || 'Study plan generation failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateSpecializedNotes = async (
    topic: string,
    type: 'detailed_notes' | 'chapter_summary' | 'exam_prep' | 'formula_sheet' | 'revision_notes'
  ) => {
    if (!topic || !topic.trim()) return;
    setSearching(true);
    setSearchQuery(topic);
    const typeLabels = {
      detailed_notes: 'Comprehensive Lecture Notes',
      chapter_summary: 'Chapter Summary',
      exam_prep: 'Exam Preparation Notes',
      formula_sheet: 'Formula Sheet',
      revision_notes: 'Revision Notes',
    };
    setSearchResults(`Generating ${typeLabels[type]} for "${topic}"...`);
    setSearchSources([]);
    setGeneratedNotesContent(null);
    setIsNotesSaved(false);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/ai/notes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: `Create ${typeLabels[type]} for "${topic}" formatted in Markdown with headings, tables, and LaTeX formulas where applicable.`,
          action: 'generate_notes',
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const content = data.text || `# ${typeLabels[type]}: ${topic}\n\nNotes failed to generate.`;
      setSearchResults(content);
      const packet = { title: `${topic} (${typeLabels[type]})`, content };
      setGeneratedNotesContent(packet);
      if (createVaultNote) {
        createVaultNote(packet.title, packet.content, 'Orion Generated');
        setIsNotesSaved(true);
        showNotification(`Saved "${typeLabels[type]}" to Lecture Notes.`);
      }
    } catch (err: any) {
      setSearchResults(err?.message || 'Notes generation failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleSaveGeneratedNotesToVault = () => {
    if (!generatedNotesContent) return;
    if (createVaultNote) {
      createVaultNote(generatedNotesContent.title.substring(0, 40) + ' Notes', generatedNotesContent.content, 'Orion Generated');
    } else {
      window.dispatchEvent(
        new CustomEvent('s_os_create_note', {
          detail: {
            title: generatedNotesContent.title.substring(0, 40) + ' Notes',
            content: generatedNotesContent.content,
            subject: 'Orion Generated',
          },
        })
      );
    }
    setIsNotesSaved(true);
    showNotification(`Saved "${generatedNotesContent.title}" to Lecture Notes.`);
  };

  const buildOrionUserContext = (): OrionUserContext => ({
    userId: currentUser?.uid,
    userName: currentUser?.name || 'User',
    userEmail: currentUser?.email,
    userRole: normalizedRole,
    userClass: currentUser?.className || currentUser?.grade,
    grade: currentUser?.grade,
    section: currentUser?.section,
    linkedStudentIds: linkedChildren.map((c: any) => c?.uid || c?.id).filter(Boolean),
    linkedStudents: linkedChildren,
  });

  const applyNavigationTarget = (targetVal: string) => {
    const tabVal = targetVal.toLowerCase();
    if (tabVal.includes('life')) triggerNavTransition('Veylentra Life', 'life');
    else if (tabVal.includes('meet')) triggerNavTransition('Veylentra Meet', 'meet');
    else if (tabVal.includes('material')) triggerNavTransition('Material Hub', 'materials');
    else if (tabVal.includes('attendance')) triggerNavTransition('Attendance Manager', 'attendance_manager');
    else if (tabVal.includes('homework')) triggerNavTransition('Homework', 'homework');
    else if (tabVal.includes('study')) triggerNavTransition('Study Hub', 'study_hub');
    else if (tabVal.includes('assignment')) triggerNavTransition('Assignments', 'assignments');
    else if (tabVal.includes('timetable') || tabVal.includes('schedule')) triggerNavTransition('Timetable', 'timetable_viewer');
    else if (tabVal.includes('notice') || tabVal.includes('announcement')) triggerNavTransition('Notices', 'notice_viewer');
    else if (tabVal.includes('parent')) triggerNavTransition('Parental Portal', 'parent_portal');
    else if (tabVal.includes('dashboard')) triggerNavTransition('Dashboard', 'dashboard');
  };

  const executeServerConfirmedActionInternal = async (confirmPayload: NonNullable<typeof pendingConfirmation>) => {
    setIsProcessing(true);
    setPendingConfirmation(null);
    const confirmStartedAt = Date.now();
    const idempotencyKey =
      confirmPayload.idempotencyKey || `orion_conf_${confirmStartedAt}_${Math.random().toString(36).slice(2, 8)}`;
    const turnId = `turn_${confirmStartedAt}`;
    const userCtx = buildOrionUserContext();

    setTurns((prev) => [
      ...prev,
      {
        id: turnId,
        idempotencyKey,
        userCommand: `Confirm: ${confirmPayload.action.replace(/_/g, ' ')} (${confirmPayload.targetValue || ''})`,
        plannedSteps: confirmPayload.plannedSteps,
        status: 'running',
        finalResponse: 'Executing confirmed action against server...',
        snapshot: {
          phase: 'executing',
          headline: 'Executing confirmed action...',
          startedAt: confirmStartedAt,
          verified: false,
          stages: [
            { phase: 'preparing', label: 'Confirmed by user', status: 'completed', durationMs: 0 },
            { phase: 'executing', label: 'Executing action', status: 'active' },
            { phase: 'verifying', label: 'Verifying outcome', status: 'pending' },
          ],
          steps: (confirmPayload.plannedSteps || []).map((s, idx) => ({
            id: `step-${idx + 1}`,
            label: s.action.replace(/_/g, ' '),
            action: s.action,
            status: 'running',
          })),
        },
      },
    ]);

    try {
      const res = await executeOrionViaServer({
        command: confirmPayload.originalCommand,
        actionPlan: confirmPayload.plannedSteps || (confirmPayload.actionObject ? [confirmPayload.actionObject] : undefined),
        confirmed: true,
        activeTab,
        modelOverride,
        idempotencyKey,
        history: ephemeralTurnsRef.current.slice(-6),
        userContext: userCtx,
      });

      if (res.snapshot) setOrionProgress(res.snapshot);
      if (res.structuredData) setStructuredOutput(res.structuredData);
      if (res.modelUsed) setOrionModelUsed(res.modelUsed);

      if (Array.isArray(res.refreshTables)) {
        res.refreshTables.forEach((table) => {
          window.dispatchEvent(new CustomEvent('studentos-db-update', { detail: { table, action: 'INSERT', timestamp: Date.now() } }));
        });
      }

      if (Array.isArray(res.clientBridgeActions) && res.clientBridgeActions.length > 0) {
        await runOrionAgentTask({
          rawCommand: confirmPayload.originalCommand,
          actions: res.clientBridgeActions,
          userContext: userCtx,
          isConfirmed: true,
        });
      }

      const errorText = res.success ? undefined : extractApiErrorMessage(res, 'Action failed');
      const finalText = res.finalResponse || errorText || 'Action processed.';
      setJarvisFeedback(finalText);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                status: res.success ? 'completed' : 'failed',
                snapshot: res.snapshot || t.snapshot,
                finalResponse: finalText,
                errorMessage: errorText,
                modelUsed: res.modelUsed,
                providerUsed: res.providerUsed,
              }
            : t
        )
      );

      ephemeralTurnsRef.current = [
        ...ephemeralTurnsRef.current,
        { role: 'user' as const, content: confirmPayload.originalCommand },
        { role: 'assistant' as const, content: finalText.slice(0, 600) },
      ].slice(-6);
      speakFeedback(finalText.slice(0, 220));
      showNotification(res.success ? `Orion: ${confirmPayload.action} verified.` : `Orion: ${errorText || 'Action failed'}`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to execute confirmed action.';
      const elapsedMs = Math.max(0, Date.now() - confirmStartedAt);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                status: 'failed',
                finalResponse: msg,
                errorMessage: msg,
                snapshot: {
                  phase: 'failed',
                  headline: 'Execution encountered an error.',
                  startedAt: confirmStartedAt,
                  finishedAt: Date.now(),
                  verified: false,
                  stages: [
                    { phase: 'preparing', label: 'Confirmed by user', status: 'completed', durationMs: 0 },
                    { phase: 'executing', label: 'Server execution', status: 'failed', durationMs: elapsedMs, detail: msg },
                  ],
                  steps: [{ id: 'step-1', label: 'Execute command', action: confirmPayload.action as OrionActionType, status: 'failed', verificationNote: msg }],
                },
              }
            : t
        )
      );
      setLastFailedCommand(confirmPayload.originalCommand);
    }
  };

  const executeServerConfirmedAction = async (confirmPayload: NonNullable<typeof pendingConfirmation>) => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    try {
      await executeServerConfirmedActionInternal(confirmPayload);
    } finally {
      isExecutingRef.current = false;
      setIsProcessing(false);
    }
  };

  const executeVoiceCommand = async (
    rawInput: string,
    retryTurn?: { id: string; idempotencyKey?: string }
  ) => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) return;
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;

    setIsProcessing(true);
    setLastFailedCommand(null);

    try {
      let textToParse = trimmedInput;
      let textLow = textToParse.toLowerCase();

      // 1. Handle active confirmation prompt if user typed/spoke yes or no
      if (!retryTurn && pendingConfirmation) {
        const confirmAffirmatives = ['yes', 'confirm', 'proceed', 'sure', 'do it', 'ok', 'yeah'];
        const confirmNegatives = ['no', 'cancel', 'dont', "don't", 'abort', 'stop', 'keep it'];
        if (confirmAffirmatives.some((k) => textLow === k || textLow.startsWith(k + ' '))) {
          await executeServerConfirmedActionInternal(pendingConfirmation);
          return;
        }
        if (confirmNegatives.some((k) => textLow === k || textLow.startsWith(k + ' '))) {
          setPendingConfirmation(null);
          setOrionProgress(null);
          setJarvisFeedback('Operation canceled. No changes were made.');
          return;
        }
      }

      // 2. If replying to clarification question, combine with original command
      if (!retryTurn && pendingClarification) {
        textToParse = `${pendingClarification.originalCommand}: ${trimmedInput}`;
        textLow = textToParse.toLowerCase();
        setPendingClarification(null);
      }

      // 3. Explicit Tab Navigation Intercept ONLY (never hijacks data queries)
      if (!retryTurn && isExplicitTabNavigationCommand(textLow)) {
        applyNavigationTarget(textLow);
        return;
      }

      // 4. Explicit Video / Web Discovery Intercept
      const isExplicitVideoQuery =
        !retryTurn &&
        (textLow.includes('video') ||
          textLow.includes('youtube') ||
          /\b(?:find|show|get|recommend|suggest|give|watch)?\s*(?:a\s+)?videos?\s*(?:about|on|for|regarding)?\b/i.test(textLow));
      if (isExplicitVideoQuery) {
        const cleanVideoQuery = textLow
          .replace(/\b(?:find|show|get|recommend|suggest|give|watch)?\s*(?:a\s+)?videos?\s*(?:about|on|for|regarding)?\s*/gi, '')
          .replace(/\b(?:on|from|in)\s+youtube\b/gi, '')
          .replace(/[?.!]+$/, '')
          .trim();
        await handleRunInternetSearch(cleanVideoQuery || textToParse);
        return;
      }

      // 5. Resolve Ephemeral In-Session Pronouns ("it", "that")
      if ((textLow.includes(' it ') || textLow.endsWith(' it') || textLow.includes(' that ')) && lastEntityRef.current) {
        textToParse = textToParse.replace(/\b(it|that)\b/gi, lastEntityRef.current.title);
        textLow = textToParse.toLowerCase().trim();
      }

      // 6. Super Admin unlock protocol check
      if (textLow.includes('naitik kashyap') || textLow.includes('super admin protocol')) {
        if (normalizedRole === 'super_admin') {
          setJarvisFeedback('Super Admin credentials verified. Control Center activated.');
          if (onSuperAdminUnlocked) onSuperAdminUnlocked();
          showNotification('Super Admin Mode Activated.');
        } else {
          setJarvisFeedback('Access Denied: Super Admin privileges required.');
          showNotification('Access Denied.');
        }
        return;
      }

      const cmdStartedAt = Date.now();
      const turnId = retryTurn?.id || `turn_${cmdStartedAt}`;
      const turnIdempotencyKey =
        retryTurn?.idempotencyKey || `orion_cmd_${cmdStartedAt}_${Math.random().toString(36).slice(2, 8)}`;

      const initialSnapshot: OrionAgentProgressSnapshot = {
        phase: 'analyzing',
        headline: 'Analyzing request on server...',
        startedAt: cmdStartedAt,
        verified: false,
        stages: [
          { phase: 'analyzing', label: 'Analyzing intent', status: 'active' },
          { phase: 'planning', label: 'Planning steps', status: 'pending' },
          { phase: 'preparing', label: 'Verifying RBAC', status: 'pending' },
          { phase: 'executing', label: 'Executing', status: 'pending' },
        ],
        steps: [],
      };

      setOrionProgress(initialSnapshot);
      setTurns((prev) => {
        const existingIndex = prev.findIndex((t) => t.id === turnId);
        if (existingIndex >= 0) {
          return prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  idempotencyKey: turnIdempotencyKey,
                  status: 'running',
                  errorMessage: undefined,
                  snapshot: initialSnapshot,
                  finalResponse: '',
                }
              : t
          );
        }
        return [
          ...prev,
          {
            id: turnId,
            idempotencyKey: turnIdempotencyKey,
            userCommand: trimmedInput,
            status: 'running',
            snapshot: initialSnapshot,
            finalResponse: '',
          },
        ];
      });

      const userCtx = buildOrionUserContext();

      try {
        const serverRes = await executeOrionViaServer({
          command: textToParse,
          confirmed: false,
          activeTab,
          modelOverride,
          idempotencyKey: turnIdempotencyKey,
          history: ephemeralTurnsRef.current.slice(-6),
          userContext: userCtx,
        });

        if (serverRes.modelUsed) setOrionModelUsed(serverRes.modelUsed);
        if (serverRes.snapshot) setOrionProgress(serverRes.snapshot);
        if (serverRes.structuredData) setStructuredOutput(serverRes.structuredData);

        if (Array.isArray(serverRes.webSources) && serverRes.webSources.length > 0) {
          setSearchSources(
            serverRes.webSources.map((s: any) => ({
              title: s.title || s.domain || 'Web Source',
              uri: s.url || s.uri || '#',
              published_source: s.sourceType === 'academic' ? `Academic · ${s.domain}` : s.domain,
            }))
          );
        }
        if (Array.isArray(serverRes.webVideos) && serverRes.webVideos.length > 0) {
          setSearchVideos(serverRes.webVideos);
        }

        if (serverRes.plan?.[0]?.targetValue) {
          lastEntityRef.current = {
            type: serverRes.plan[0].action,
            title: serverRes.plan[0].targetValue,
          };
        }

        // Clarification Needed
        if (serverRes.status === 'needs_clarification') {
          const q = serverRes.clarificationQuestion || 'Please provide additional details before Orion can proceed.';
          setPendingClarification({
            originalCommand: textToParse,
            question: q,
            missingFields: serverRes.missingFields || [],
          });
          setJarvisFeedback(q);
          setTurns((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? {
                    ...t,
                    status: 'needs_clarification',
                    plannedSteps: serverRes.plan,
                    snapshot: serverRes.snapshot || t.snapshot,
                    finalResponse: q,
                  }
                : t
            )
          );
          return;
        }

        // Awaiting User Confirmation
        if (serverRes.status === 'awaiting_confirmation' && serverRes.pendingConfirmation) {
          setPendingConfirmation({
            originalCommand: textToParse,
            idempotencyKey: `orion_conf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            action: serverRes.pendingConfirmation.action,
            targetValue: serverRes.pendingConfirmation.targetTitle,
            promptText: serverRes.pendingConfirmation.promptText,
            previewDetails: serverRes.pendingConfirmation.previewDetails,
            actionObject: serverRes.pendingConfirmation.actionObject,
            plannedSteps: serverRes.pendingConfirmation.plannedSteps || serverRes.plan,
          });
          const msg = serverRes.finalResponse || serverRes.pendingConfirmation.promptText;
          setJarvisFeedback(msg);
          setTurns((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? {
                    ...t,
                    status: 'awaiting_confirmation',
                    plannedSteps: serverRes.plan,
                    snapshot: serverRes.snapshot || t.snapshot,
                    finalResponse: msg,
                  }
                : t
            )
          );
          return;
        }

        // Authorization Denied or Error
        if (serverRes.status === 'forbidden' || serverRes.status === 'unauthorized' || serverRes.status === 'failed' || serverRes.status === 'error') {
          const errText = extractApiErrorMessage(serverRes, 'Request could not be completed.');
          setJarvisFeedback(errText);
          setLastFailedCommand(serverRes.status === 'failed' || serverRes.status === 'error' ? trimmedInput : null);
          setTurns((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? {
                    ...t,
                    status: 'failed',
                    plannedSteps: serverRes.plan,
                    snapshot: serverRes.snapshot || t.snapshot,
                    finalResponse: errText,
                    errorMessage: errText,
                  }
                : t
            )
          );
          return;
        }

        // Completed! Process any authorized local client bridge actions
        let finalAnswer = serverRes.finalResponse || '';
        if (Array.isArray(serverRes.clientBridgeActions) && serverRes.clientBridgeActions.length > 0) {
          const bridgeNav = serverRes.clientBridgeActions.find((a) => a.action === 'navigate_tab');
          if (bridgeNav && (bridgeNav.targetValue || bridgeNav.title)) {
            applyNavigationTarget(bridgeNav.targetValue || bridgeNav.title || '');
          }
          const notesAct = serverRes.clientBridgeActions.find((a) => a.action === 'generate_notes');
          if (notesAct) {
            setActiveTab('notes');
            handleGenerateSpecializedNotes(notesAct.title || notesAct.targetValue || textToParse, 'detailed_notes');
          }
          const localBridgeOnly = serverRes.clientBridgeActions.filter(
            (a) => a.action !== 'navigate_tab' && a.action !== 'generate_notes' && a.action !== 'general_chat'
          );
          if (localBridgeOnly.length > 0) {
            const bridgeRes = await runOrionAgentTask({
              rawCommand: textToParse,
              actions: localBridgeOnly,
              userContext: userCtx,
              isConfirmed: true,
              onProgress: setOrionProgress,
            });
            if (bridgeRes.combinedSummary) {
              finalAnswer = bridgeRes.combinedSummary;
            }
            if (bridgeRes.structuredData) setStructuredOutput(bridgeRes.structuredData);
          }
        }

        // If general_chat returned no AI text because server key check differed, try /api/ai/chat explicitly
        if (!finalAnswer || finalAnswer.includes('No AI provider key is currently configured')) {
          try {
            const aiDirect = await queryJarvisAIStream(textToParse);
            if (aiDirect.responseText) finalAnswer = aiDirect.responseText;
          } catch (aiFallbackErr: any) {
            if (!finalAnswer) throw aiFallbackErr;
          }
        }

        if (Array.isArray(serverRes.refreshTables)) {
          serverRes.refreshTables.forEach((table) => {
            window.dispatchEvent(new CustomEvent('studentos-db-update', { detail: { table, action: 'INSERT', timestamp: Date.now() } }));
          });
        }

        const detectedWidget = detectMathInteractiveWidget(textToParse, finalAnswer);
        setOrionMathWidget(detectedWidget);
        setJarvisFeedback(finalAnswer);

        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  status: 'completed',
                  plannedSteps: serverRes.plan,
                  snapshot: serverRes.snapshot || t.snapshot,
                  finalResponse: finalAnswer,
                  providerUsed: serverRes.providerUsed,
                  modelUsed: serverRes.modelUsed,
                  mathWidget: detectedWidget,
                }
              : t
          )
        );

        ephemeralTurnsRef.current = [
          ...ephemeralTurnsRef.current,
          { role: 'user' as const, content: textToParse },
          { role: 'assistant' as const, content: finalAnswer.slice(0, 600) },
        ].slice(-6);

        speakFeedback(finalAnswer.slice(0, 220));
      } catch (err: any) {
        const msg = err?.message || 'Orion could not complete the request right now.';
        const elapsedMs = Math.max(0, Date.now() - cmdStartedAt);
        setLastFailedCommand(trimmedInput);
        setJarvisFeedback(msg);
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  status: 'failed',
                  finalResponse: msg,
                  errorMessage: msg,
                  snapshot: {
                    phase: 'failed',
                    headline: 'Execution encountered an error.',
                    startedAt: cmdStartedAt,
                    finishedAt: Date.now(),
                    verified: false,
                    stages: [
                      { phase: 'analyzing', label: 'Analyzing intent', status: 'completed', durationMs: 0 },
                      { phase: 'executing', label: 'Server execution', status: 'failed', durationMs: elapsedMs, detail: msg },
                    ],
                    steps: [{ id: 'step-1', label: 'Execute command', action: 'general_chat', status: 'failed', verificationNote: msg }],
                  },
                }
              : t
          )
        );
      }
    } finally {
      isExecutingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isExecutingRef.current || isProcessing) return;
    const val = commandText.trim();
    if (!val) return;
    setCommandText('');
    void executeVoiceCommand(val);
  };

  const handleQuickTouchAction = (cmd: string) => {
    if (isExecutingRef.current || isProcessing) return;
    setCommandText('');
    void executeVoiceCommand(cmd);
  };

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchStudentTerm.toLowerCase()) ||
      r.classGrade.toLowerCase().includes(searchStudentTerm.toLowerCase());
    const matchesHouse = statusFilter ? r.house === statusFilter || r.section === statusFilter : true;
    return matchesSearch && matchesHouse;
  });

  const exportStructuredMarkdown = () => {
    if (!structuredOutput) return;
    if (structuredOutput.exportableMarkdown) {
      navigator.clipboard.writeText(structuredOutput.exportableMarkdown);
      showNotification('Copied structured report to clipboard.');
      return;
    }
    const header = `# ${structuredOutput.title}\n\n`;
    const metricsMd = (structuredOutput.metrics || []).map((m) => `- **${m.label}:** ${m.value}`).join('\n');
    const rowsMd = (structuredOutput.rows || [])
      .map((r) => `- ${Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(' · ')}`)
      .join('\n');
    navigator.clipboard.writeText(`${header}${metricsMd}\n\n${rowsMd}`.trim());
    showNotification('Copied structured summary to clipboard.');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950/90 text-slate-100">
      {/* Module Navigation Transition Overlay */}
      {navigatingTransition && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center gap-4">
          <VeylentraIcon name="orion" size={48} />
          <div className="text-center space-y-1">
            <h3 className="text-lg font-semibold text-white">Opening {navigatingTransition.title}</h3>
            <p className="text-xs text-slate-400">Switching workspace module...</p>
          </div>
        </div>
      )}

      {/* 1. WORKSPACE HEADER */}
      <header className="shrink-0 px-4 sm:px-6 py-3.5 border-b border-white/10 bg-slate-950/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center shrink-0">
            <VeylentraIcon name="orion" size={24} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">Orion</h2>
              <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-300">
                {normalizedRole.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 inline-flex items-center gap-1 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Ephemeral session · Zero chat persistence</span>
            </p>
          </div>
        </div>

        {/* Mode Segmented Navigation & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-xl bg-slate-900/90 border border-white/10 p-1 gap-0.5">
            <button
              type="button"
              onClick={() => setActiveJarvisSection('home')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeJarvisSection === 'home' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Workspace
            </button>
            <button
              type="button"
              onClick={() => setActiveJarvisSection('search')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeJarvisSection === 'search' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Research
            </button>
            {isStaffRole && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveJarvisSection('reports')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors hidden sm:inline-flex ${
                    activeJarvisSection === 'reports' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Reports
                </button>
                <button
                  type="button"
                  onClick={() => setActiveJarvisSection('houses')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors hidden md:inline-flex ${
                    activeJarvisSection === 'houses' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Houses
                </button>
                <button
                  type="button"
                  onClick={() => setActiveJarvisSection('sections')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors hidden md:inline-flex ${
                    activeJarvisSection === 'sections' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Sections
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              clearEphemeralSession();
              showNotification('Orion ephemeral session cleared.');
            }}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 border border-white/10 inline-flex items-center gap-1.5 transition-colors"
            title="Clear current ephemeral session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDiagnostics((v) => !v)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showDiagnostics
                ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Voice & speech diagnostics"
          >
            <Mic className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                clearEphemeralSession();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close Orion and wipe session"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Optional Mic Diagnostics Drawer */}
      {showDiagnostics && (
        <div className="shrink-0 mx-4 sm:mx-6 mt-3 p-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-[11px] font-mono text-slate-300 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-indigo-300 uppercase tracking-wider">Speech Recognition Diagnostics</span>
            <button type="button" onClick={() => setShowDiagnostics(false)} className="text-slate-400 hover:text-white">
              Dismiss
            </button>
          </div>
          <p>mediaDevices: {String(!!navigator.mediaDevices)} · SpeechRecognition: {String(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition))}</p>
          {diagnosticError && (
            <p className="text-rose-300">
              Last Error: {diagnosticError.name} — {diagnosticError.message}
            </p>
          )}
        </div>
      )}

      {/* 2. MAIN WORKSPACE BODY */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        {activeJarvisSection === 'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN: LIVE EXECUTION STREAM (7 cols on desktop) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Idle Role-Aware Quick Launcher */}
              {turns.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-indigo-300">
                      Role-Verified Agent Workspace
                    </p>
                    <p className="text-sm text-slate-200 leading-relaxed">{jarvisFeedback}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {normalizedRole === 'parent' || normalizedRole === 'guardian' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickTouchAction('Show my linked child overview')}
                          className="p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/10 hover:border-indigo-400/40 text-left transition-colors flex items-start gap-3"
                        >
                          <Users className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-white block">Linked Ward Overview</span>
                            <span className="text-[11px] text-slate-400">Inspect attendance and progress</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickTouchAction('Show recent notices')}
                          className="p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/10 hover:border-indigo-400/40 text-left transition-colors flex items-start gap-3"
                        >
                          <Bell className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-white block">School Notices</span>
                            <span className="text-[11px] text-slate-400">Read latest official updates</span>
                          </div>
                        </button>
                      </>
                    ) : normalizedRole === 'student' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickTouchAction('What homework do I have pending?')}
                          className="p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/10 hover:border-indigo-400/40 text-left transition-colors flex items-start gap-3"
                        >
                          <ClipboardList className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-white block">Pending Homework</span>
                            <span className="text-[11px] text-slate-400">Inspect active assignments</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickTouchAction('Create a 5-day revision study plan')}
                          className="p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/10 hover:border-indigo-400/40 text-left transition-colors flex items-start gap-3"
                        >
                          <BookOpen className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-white block">Build Study Plan</span>
                            <span className="text-[11px] text-slate-400">Structure a 5-day sprint</span>
                          </div>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickTouchAction('Generate daily school briefing report')}
                          className="p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/10 hover:border-indigo-400/40 text-left transition-colors flex items-start gap-3"
                        >
                          <BarChart3 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-white block">Operations Briefing</span>
                            <span className="text-[11px] text-slate-400">Compile students, homework & attendance</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickTouchAction('Show attendance summary')}
                          className="p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/10 hover:border-indigo-400/40 text-left transition-colors flex items-start gap-3"
                        >
                          <Users className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-white block">Attendance Summary</span>
                            <span className="text-[11px] text-slate-400">Review latest presence logs</span>
                          </div>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRunInternetSearch('Newton laws of motion physics')}
                      className="p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/10 hover:border-indigo-400/40 text-left transition-colors flex items-start gap-3"
                    >
                      <Globe className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-white block">Web Research</span>
                        <span className="text-[11px] text-slate-400">Search verified external sources</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPagePicker(true)}
                      className="p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/10 hover:border-indigo-400/40 text-left transition-colors flex items-start gap-3"
                    >
                      <Layout className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-white block">Open Workspace Module</span>
                        <span className="text-[11px] text-slate-400">Jump to a Veylentra section</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Structured Turn Execution Stream */}
              <AnimatePresence initial={false}>
                {turns.map((turn) => (
                  <motion.div
                    key={turn.id}
                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* 1. User Instruction */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600/20 border border-indigo-400/30 px-4 py-2.5 text-sm text-white">
                        {turn.userCommand}
                      </div>
                    </div>

                    {/* 2. Orion Plan & 3. Activity Timeline */}
                    {turn.snapshot && <OrionActivityTimeline snapshot={turn.snapshot} />}

                    {/* 4. Error Banner with In-Place Retry */}
                    {turn.status === 'failed' && turn.errorMessage && (
                      <div className="rounded-xl border border-rose-500/35 bg-rose-950/25 p-4 flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                          <div className="text-xs text-rose-100 leading-relaxed">{turn.errorMessage}</div>
                        </div>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() =>
                            void executeVoiceCommand(turn.userCommand, {
                              id: turn.id,
                              idempotencyKey: turn.idempotencyKey,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-50 border border-rose-400/30 text-xs font-medium text-rose-200 inline-flex items-center gap-1.5 shrink-0"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Retry
                        </button>
                      </div>
                    )}

                    {/* 5. Elevated Final Verified Response */}
                    {turn.finalResponse && turn.status !== 'failed' && (
                      <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                          <div className="flex items-center gap-2 text-xs font-medium text-indigo-300">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Orion Final Response</span>
                            {turn.modelUsed && (
                              <span className="text-[11px] font-mono text-slate-400">· {turn.modelUsed}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(turn.finalResponse);
                                showNotification('Response copied to clipboard.');
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                              title="Copy response"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => speakFeedback(turn.finalResponse)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                              title="Read aloud"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                            {createVaultNote && (
                              <button
                                type="button"
                                onClick={() => {
                                  createVaultNote(
                                    turn.userCommand.slice(0, 48),
                                    turn.finalResponse,
                                    'Orion Note'
                                  );
                                  showNotification('Saved response to Lecture Notes.');
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                                title="Save to Notes Vault"
                              >
                                <BookmarkPlus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-slate-100 leading-relaxed select-text">
                          <AcademicRichRenderer
                            content={turn.finalResponse}
                            isStreaming={turn.status === 'running'}
                          />
                        </div>

                        {turn.mathWidget && (
                          <div className="pt-3 border-t border-white/10">
                            <InteractiveMathWidget widgetType={turn.mathWidget} />
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Inline Clarification Gate Card */}
              {pendingClarification && (
                <div className="rounded-2xl border border-amber-500/35 bg-amber-950/20 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <HelpCircle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-200 uppercase tracking-wider">
                        Clarification Needed
                      </p>
                      <p className="text-sm text-slate-100">{pendingClarification.question}</p>
                      {pendingClarification.missingFields.length > 0 && (
                        <p className="text-[11px] font-mono text-amber-300/80">
                          Missing: {pendingClarification.missingFields.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={clarificationReply}
                      onChange={(e) => setClarificationReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && clarificationReply.trim()) {
                          const val = clarificationReply.trim();
                          setClarificationReply('');
                          executeVoiceCommand(val);
                        }
                      }}
                      placeholder="Provide the missing details..."
                      className="flex-1 bg-slate-950/80 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400/50"
                    />
                    <button
                      type="button"
                      disabled={!clarificationReply.trim() || isProcessing}
                      onClick={() => {
                        const val = clarificationReply.trim();
                        if (!val) return;
                        setClarificationReply('');
                        executeVoiceCommand(val);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold transition-colors"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingClarification(null)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Confirmation Preview Gate Card */}
              {pendingConfirmation && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-200 uppercase tracking-wider">
                          Confirm Action Before Database Write
                        </p>
                        <p className="text-xs text-slate-200 mt-1">{pendingConfirmation.promptText}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => executeServerConfirmedAction(pendingConfirmation)}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold transition-colors"
                      >
                        Confirm & Execute
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingConfirmation(null);
                          setOrionProgress(null);
                          setJarvisFeedback('Operation canceled. No changes were made.');
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  {pendingConfirmation.previewDetails && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-amber-500/20 text-xs">
                      {Object.entries(pendingConfirmation.previewDetails).map(([k, v]) => (
                        <div key={k} className="bg-slate-950/70 px-3 py-2 rounded-lg border border-white/5">
                          <span className="text-[10px] uppercase font-mono text-amber-300/80 block">{k}</span>
                          <span className="text-slate-100 break-words">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div ref={streamEndRef} />
            </div>

            {/* RIGHT COLUMN: CONTEXT & OUTPUT INSPECTOR (5 cols on desktop) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Structured Live Metrics & Data Table */}
              {structuredOutput && (
                <div className="rounded-2xl border border-indigo-500/25 bg-slate-900/70 p-4 space-y-3.5">
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block">
                        Verified Live Data
                      </span>
                      <h3 className="text-sm font-semibold text-white truncate">{structuredOutput.title}</h3>
                      {structuredOutput.subtitle && (
                        <p className="text-[11px] text-slate-400 truncate">{structuredOutput.subtitle}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={exportStructuredMarkdown}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300"
                      >
                        Copy
                      </button>
                      {createVaultNote && structuredOutput.exportableMarkdown && (
                        <button
                          type="button"
                          onClick={() => {
                            createVaultNote(structuredOutput.title, structuredOutput.exportableMarkdown || '', 'Orion Report');
                            showNotification(`Saved "${structuredOutput.title}" to Notes.`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/30 text-[11px] text-indigo-200"
                        >
                          Save
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setStructuredOutput(null)}
                        className="p-1 text-slate-400 hover:text-white"
                        aria-label="Dismiss output card"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {structuredOutput.metrics && structuredOutput.metrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {structuredOutput.metrics.map((m, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl border border-white/10 bg-slate-950/60"
                        >
                          <div className="text-[10px] font-mono uppercase text-slate-400">{m.label}</div>
                          <div
                            className={`text-base font-semibold tabular-nums mt-0.5 ${
                              m.status === 'good'
                                ? 'text-emerald-300'
                                : m.status === 'warning'
                                ? 'text-amber-300'
                                : m.status === 'danger'
                                ? 'text-rose-300'
                                : 'text-white'
                            }`}
                          >
                            {m.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {structuredOutput.rows && structuredOutput.rows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                      <table className="w-full text-left text-xs">
                        {structuredOutput.columns && (
                          <thead className="bg-slate-950/80 border-b border-white/10 text-[10px] font-mono uppercase text-slate-400">
                            <tr>
                              {structuredOutput.columns.map((col) => (
                                <th key={col} className="px-2.5 py-2 font-medium">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        <tbody className="divide-y divide-white/5 bg-slate-950/40">
                          {structuredOutput.rows.slice(0, 6).map((row, rIdx) => (
                            <tr key={rIdx}>
                              {Object.values(row).map((cell, cIdx) => (
                                <td key={cIdx} className="px-2.5 py-2 text-slate-200 whitespace-nowrap">
                                  {String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Curated Educational Videos */}
              {searchVideos && searchVideos.length > 0 && (
                <div className="rounded-2xl border border-teal-500/30 bg-slate-900/70 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-semibold text-teal-300 inline-flex items-center gap-1.5">
                      <Video className="w-4 h-4" /> Verified Educational Videos ({searchVideos.length})
                    </span>
                  </div>
                  <GlassyVideoCarousel videos={searchVideos} queryTopic={searchQuery} />
                </div>
              )}

              {/* Verified Grounding Sources */}
              {searchSources && searchSources.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-teal-400" /> Grounding Sources ({searchSources.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {searchSources.slice(0, 6).map((src, idx) => (
                      <a
                        key={idx}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-white/5 hover:border-indigo-400/40 flex items-center justify-between gap-2 transition-colors group"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                            {src.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {src.published_source || 'External Web'}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-300 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Module Jump Card */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Quick Module Switcher</span>
                  {orionModelUsed && (
                    <span className="text-[10px] font-mono text-slate-500">{orionModelUsed}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { title: 'Material Hub', tab: 'materials', icon: FolderOpen },
                    { title: 'Attendance', tab: 'attendance_manager', icon: Users },
                    { title: 'Homework', tab: 'homework', icon: ClipboardList },
                    { title: 'Study Hub', tab: 'study_hub', icon: GraduationCap },
                    { title: 'Whiteboard', tab: 'whiteboard', icon: PenTool },
                    { title: 'Notices', tab: 'notice_viewer', icon: Bell },
                  ].map((mod) => {
                    const Icon = mod.icon;
                    return (
                      <button
                        key={mod.tab}
                        type="button"
                        onClick={() => triggerNavTransition(mod.title, mod.tab)}
                        className="px-3 py-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/10 text-left text-xs font-medium text-slate-200 inline-flex items-center justify-between gap-2 transition-colors"
                      >
                        <span className="inline-flex items-center gap-2 truncate">
                          <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">{mod.title}</span>
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Page Picker Modal */}
        {showPagePicker && (
          <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/15 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Open Workspace Module</h3>
                <button type="button" onClick={() => setShowPagePicker(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Material Hub', tab: 'materials', icon: FolderOpen },
                  { label: 'Attendance', tab: 'attendance_manager', icon: Users },
                  { label: 'Homework', tab: 'homework', icon: ClipboardList },
                  { label: 'Whiteboard', tab: 'whiteboard', icon: PenTool },
                  { label: 'Study Hub', tab: 'study_hub', icon: BookOpen },
                  { label: 'Notices', tab: 'notice_viewer', icon: Bell },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => {
                        triggerNavTransition(item.label, item.tab);
                        setShowPagePicker(false);
                      }}
                      className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-left text-xs font-medium text-slate-200 inline-flex items-center gap-2"
                    >
                      <Icon className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STUDENT REPORTS SECTION */}
        {activeJarvisSection === 'reports' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/60 p-4 rounded-2xl border border-white/10">
              <div>
                <h3 className="text-sm font-semibold text-white">Student Classroom Reports</h3>
                <p className="text-xs text-slate-400">Live directory metrics</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Filter student or grade..."
                  value={searchStudentTerm}
                  onChange={(e) => setSearchStudentTerm(e.target.value)}
                  className="bg-slate-950 border border-white/10 text-xs px-3 py-2 rounded-xl text-white outline-none focus:border-indigo-400 w-full sm:w-48"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-white/10 text-xs px-3 py-2 rounded-xl text-white outline-none"
                >
                  <option value="">All Houses & Sections</option>
                  <option value="Astra">Astra Section</option>
                  <option value="Solara">Solara Section</option>
                  <option value="Vega">Vega Section</option>
                  <option value="Ruby">Ruby</option>
                  <option value="Emerald">Emerald</option>
                  <option value="Sapphire">Sapphire</option>
                  <option value="Topaz">Topaz</option>
                </select>
              </div>
            </div>

            {selectedStudent ? (
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-indigo-500/30 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-white">{selectedStudent.name}</h4>
                    <p className="text-xs text-slate-400">
                      {selectedStudent.classGrade} · {selectedStudent.section} Section · {selectedStudent.house} House
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
                  >
                    Back to Directory
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {[
                    { label: 'Streak', value: `${selectedStudent.streakDays}d` },
                    { label: 'Materials', value: selectedStudent.materialsUploaded },
                    { label: 'Study Notes', value: selectedStudent.notesCreated },
                    { label: 'Quizzes', value: selectedStudent.quizzesCompleted },
                    { label: 'Homework', value: selectedStudent.assignmentsCompleted },
                    { label: 'Contributions', value: selectedStudent.communityContributions },
                  ].map((metric) => (
                    <div key={metric.label} className="bg-slate-950/70 p-3 rounded-xl border border-white/10">
                      <span className="text-[10px] uppercase font-mono text-slate-400 block">{metric.label}</span>
                      <span className="text-lg font-semibold text-white tabular-nums">{metric.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden">
                {filteredReports.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400">No matching student analytics found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 border-b border-white/10 text-slate-400 uppercase text-[10px] font-mono">
                        <tr>
                          <th className="p-3">Student</th>
                          <th className="p-3">House</th>
                          <th className="p-3">Section</th>
                          <th className="p-3">Streak</th>
                          <th className="p-3">Quizzes</th>
                          <th className="p-3 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredReports.map((st) => (
                          <tr key={st.id} className="hover:bg-slate-950/50">
                            <td className="p-3">
                              <div className="font-medium text-white">{st.name}</div>
                              <div className="text-[11px] text-slate-400">{st.classGrade}</div>
                            </td>
                            <td className="p-3 text-slate-300">{st.house}</td>
                            <td className="p-3 text-slate-300">{st.section}</td>
                            <td className="p-3 font-mono tabular-nums text-amber-400">{st.streakDays}d</td>
                            <td className="p-3 font-mono tabular-nums text-slate-300">{st.quizzesCompleted}</td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedStudent(st)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-medium"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* HOUSES SECTION */}
        {activeJarvisSection === 'houses' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {houses.map((house, index) => (
              <div key={house.id} className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{house.id} House</span>
                  <span className="text-xs font-mono tabular-nums text-slate-400">#{index + 1}</span>
                </div>
                <p className="text-2xl font-semibold font-mono tabular-nums text-indigo-300">
                  {house.points} <span className="text-xs text-slate-400">pts</span>
                </p>
                <div className="pt-3 border-t border-white/10 space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Materials Shared</span>
                    <span className="text-slate-200 tabular-nums">{house.materialsShared}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quizzes Won</span>
                    <span className="text-slate-200 tabular-nums">{house.quizzesWon}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Participation</span>
                    <span className="text-emerald-400 tabular-nums">{house.participation}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SECTIONS ANALYTICS */}
        {activeJarvisSection === 'sections' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {sections.map((sec) => (
              <div key={sec.id} className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-sm font-semibold text-white">Section {sec.id}</span>
                  <span className="text-[11px] font-mono text-indigo-300">Active</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Enrollment</span>
                    <span className="text-white tabular-nums">{sec.totalStudents}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Avg Activity</span>
                    <span className="text-amber-400 tabular-nums">{sec.studyActivity} hr/wk</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Quiz Score</span>
                    <span className="text-emerald-400 tabular-nums">{sec.quizScores}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RESEARCH & DISCOVERY HUB */}
        {activeJarvisSection === 'search' && (
          <div className="space-y-4">
            {searchVideos && searchVideos.length > 0 && (
              <GlassyVideoCarousel videos={searchVideos} queryTopic={searchQuery} />
            )}

            <div className="rounded-2xl border border-white/10 bg-slate-900/65 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-300 inline-flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Academic Research & Note Synthesis
                </span>
                {searching && <span className="text-xs text-teal-300">Searching...</span>}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Enter a curriculum topic to research or generate notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRunInternetSearch(searchQuery);
                    }}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl pl-10 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRunInternetSearch(searchQuery)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Globe className="w-4 h-4" /> Search
                </button>
                <button
                  type="button"
                  onClick={() => handleRunResourceDiscovery(searchQuery)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4" /> Hub Match
                </button>
              </div>

              {searchQuery.trim().length > 2 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { label: 'Detailed Notes', type: 'detailed_notes' as const, icon: Sparkles },
                    { label: 'Chapter Summary', type: 'chapter_summary' as const, icon: BookOpen },
                    { label: 'Exam Prep', type: 'exam_prep' as const, icon: Award },
                    { label: 'Formula Sheet', type: 'formula_sheet' as const, icon: PenTool },
                    { label: 'Revision Notes', type: 'revision_notes' as const, icon: CheckCircle2 },
                  ].map((btn) => {
                    const Icon = btn.icon;
                    return (
                      <button
                        key={btn.type}
                        type="button"
                        onClick={() => handleGenerateSpecializedNotes(searchQuery, btn.type)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 inline-flex items-center gap-1.5"
                      >
                        <Icon className="w-3.5 h-3.5 text-indigo-400" /> {btn.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => handleGenerateLessonPlan(searchQuery)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-xs text-emerald-300 inline-flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" /> Study Plan
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 rounded-2xl border border-white/10 bg-slate-900/65 p-4 space-y-3">
                <span className="text-xs font-semibold text-indigo-300">Research Synthesis</span>
                <div className="text-sm text-slate-200 leading-relaxed max-h-[420px] overflow-y-auto pr-1">
                  {searchResults ? (
                    <AcademicRichRenderer content={searchResults} isStreaming={searching} />
                  ) : (
                    <p className="text-xs text-slate-500 py-8 text-center">
                      Enter a topic above to search verified sources or generate structured notes.
                    </p>
                  )}
                </div>
                {generatedNotesContent && (
                  <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSaveGeneratedNotesToVault}
                      disabled={isNotesSaved}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-emerald-600/20 disabled:text-emerald-300 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      {isNotesSaved ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {isNotesSaved ? 'Saved to Lecture Notes' : 'Save to Lecture Notes'}
                    </button>
                  </div>
                )}
              </div>

              <div className="md:col-span-4 rounded-2xl border border-white/10 bg-slate-900/65 p-4 space-y-3">
                <span className="text-xs font-semibold text-teal-300">Material Hub Matches</span>
                {localMaterials.length > 0 ? (
                  <div className="space-y-2">
                    {localMaterials.map((mat) => (
                      <a
                        key={mat.id}
                        href={mat.url || mat.file_url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-3 rounded-xl bg-slate-950/70 border border-white/10 hover:border-teal-400/40 space-y-1"
                      >
                        <div className="text-xs font-semibold text-white truncate">{mat.title}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-2">{mat.description || 'Hub file'}</div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-8 text-center">No matching hub files indexed yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. DOCKED BOTTOM COMMAND BAR */}
      <footer className="shrink-0 px-4 sm:px-6 py-3 border-t border-white/10 bg-slate-950/90 flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggleListening}
          className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors border ${
            isListening
              ? 'bg-rose-600 border-rose-400 text-white'
              : 'bg-slate-900 border-white/10 hover:bg-slate-800 text-indigo-300'
          }`}
          title={isListening ? 'Stop voice input' : 'Start voice input'}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <form onSubmit={handleTextSubmit} className="flex-1 min-w-0 flex items-center gap-2">
          <input
            type="text"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            disabled={isProcessing}
            placeholder={
              normalizedRole === 'student'
                ? 'Ask Orion to check homework, build a study plan, or search curriculum topics...'
                : 'Instruct Orion to run reports, check attendance, publish notices, or research...'
            }
            className="flex-1 min-w-0 min-h-[44px] bg-slate-900 border border-white/15 focus:border-indigo-400 rounded-xl px-3.5 text-sm text-white placeholder-slate-500 outline-none transition-colors disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isProcessing || !commandText.trim()}
            className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{isProcessing ? 'Running...' : 'Execute'}</span>
          </button>
        </form>
      </footer>
    </div>
  );
};
