import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Send, Volume2, Sparkles, Sliders, Users, 
  BarChart3, Award, Settings, Terminal, Play, RotateCcw, 
  Layers, Plus, Trash2, CheckCircle, RefreshCw, X, Square, BookOpen, FileText, HelpCircle, Layout, Search, Globe, PenTool
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchAllSupabaseUsers } from '../lib/supabaseUsers';
import { createCompetition, createSchoolEvent, createClub } from '../lib/supabaseLife';
import { saveSupabaseHomework, getSupabaseHomework, deleteSupabaseHomework } from '../lib/supabaseHomework';
import { createOrUpdateMeeting, deleteMeeting, fetchAllMeetings } from '../lib/supabaseMeet';
import { saveAppNotification, getAppNotifications } from '../lib/notifications';
import { executeOrionCommunicationDispatch } from '../lib/orionCommunication';
import { 
  executeOrionActionPipeline, 
  OrionAction, 
  OrionUserContext, 
  OrionActionType 
} from '../lib/orionActionExecutor';
import { StudentReport, HouseAnalytics, SectionAnalytics, TeacherCommand, JarvisHistoryItem } from '../types';

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
}

const parseInlineMarkdown = (text: string) => {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index} className="italic text-slate-300">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="px-1.5 py-0.5 bg-black/40 text-indigo-350 rounded font-mono text-[10px]">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('[') && part.includes('](')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <a key={index} href={match[2]} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline font-bold">
            {match[1]}
          </a>
        );
      }
    }
    return part;
  });
};

const renderOrionMarkdown = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  
  return (
    <div className="space-y-3 select-text text-slate-200 p-2">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed === '---' || trimmed === '***') {
          return <hr key={idx} className="my-6 border-t border-white/10" />;
        }
        if (trimmed.startsWith('### ')) {
          return <h4 key={idx} className="text-sm font-extrabold text-teal-300 mt-6 mb-2 tracking-wider uppercase font-mono">{parseInlineMarkdown(trimmed.substring(4))}</h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={idx} className="text-lg font-black text-indigo-300 mt-8 mb-3 tracking-tight">{parseInlineMarkdown(trimmed.substring(3))}</h3>;
        }
        if (trimmed.startsWith('# ')) {
          return <h2 key={idx} className="text-2xl font-black text-white mt-10 mb-4 border-b border-white/5 pb-2 tracking-tight">{parseInlineMarkdown(trimmed.substring(2))}</h2>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-3 pl-4 my-2">
              <span className="text-indigo-400 mt-1.5 text-xs font-bold">•</span>
              <p className="text-slate-200 flex-1 leading-relaxed text-sm">{parseInlineMarkdown(trimmed.substring(2))}</p>
            </div>
          );
        }
        if (/^\d+\s*\.\s/.test(trimmed)) {
          const content = trimmed.replace(/^\d+\s*\.\s/, '');
          return (
            <div key={idx} className="flex items-start gap-3 pl-4 my-2">
              <span className="text-teal-400 font-mono text-xs font-bold mt-1">{trimmed.match(/^\d+/)![0]}.</span>
              <p className="text-slate-200 flex-1 leading-relaxed text-sm">{parseInlineMarkdown(content)}</p>
            </div>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={idx} className="border-l-2 border-indigo-500 pl-4 py-1 my-3 text-slate-300 italic text-sm bg-indigo-500/5 rounded-r-lg">
              {parseInlineMarkdown(trimmed.substring(2))}
            </blockquote>
          );
        }
        if (trimmed === '') {
          return <div key={idx} className="h-3" />;
        }
        // General paragraph
        return <p key={idx} className="leading-relaxed text-sm text-slate-300 font-sans my-2">{parseInlineMarkdown(line)}</p>;
      })}
    </div>
  );
};

export const StudentOSJarvis: React.FC<StudentOSJarvisProps> = ({
  onClose,
  activeTab,
  setActiveTab,
  clearWhiteboard,
  drawShapeOnWhiteboard,
  saveWhiteboard,
  setSearchMaterialsQuery,
  setTriggerQuickQuiz,
  showNotification,
  createVaultNote,
  onSuperAdminUnlocked,
  currentUser,
  effectiveRole
}) => {
  // Navigation & Analytics Selection inside Jarvis
  const [activeJarvisSection, setActiveJarvisSection] = useState<'home' | 'reports' | 'houses' | 'sections' | 'history' | 'search'>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<string>('');
  const [searchSources, setSearchSources] = useState<{ title: string; uri: string; published_source?: string }[]>([]);
  const [generatedNotesContent, setGeneratedNotesContent] = useState<{ title: string; content: string } | null>(null);
  const [localMaterials, setLocalMaterials] = useState<any[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isNotesSaved, setIsNotesSaved] = useState<boolean>(false);

  // Voice & Input State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [commandText, setCommandText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [jarvisFeedback, setJarvisFeedback] = useState<string>('Greetings, Professor. StudentOS Orion is ready. Speak or type a command to control the smart classroom.');
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [diagnosticError, setDiagnosticError] = useState<{name: string, message: string} | null>(null);

  // Orion 2.0 Operating Assistant State & Context Memory
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    action: string;
    targetId?: string;
    targetValue?: string;
    payload?: any;
    promptText: string;
  } | null>(null);

  const lastEntityRef = useRef<{
    type: string;
    title: string;
    id?: string;
    data?: any;
  } | null>(null);

  
  // Data list states fetched from Firestore
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [houses, setHouses] = useState<HouseAnalytics[]>([]);
  const [sections, setSections] = useState<SectionAnalytics[]>([]);
  const [historyItems, setHistoryItems] = useState<JarvisHistoryItem[]>([]);
  const [commandAudit, setCommandAudit] = useState<TeacherCommand[]>([]);

  // Detailed modal or focus state
  const [selectedStudent, setSelectedStudent] = useState<StudentReport | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchStudentTerm, setSearchStudentTerm] = useState<string>('');

  // Speech Recognition Object Ref
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  const shouldListenRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || (window as any).msSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        shouldListenRef.current = true;
        setJarvisFeedback('🎤 Listening in real-time... Speak now.');
      };

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        const text = finalTranscript || interimTranscript;
        if (text) {
          setCommandText(text);
          setJarvisFeedback(`🎤 Heard: "${text}"`);
        }
      };

      rec.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        if (err.error === 'no-speech') {
          // ignore no speech
        } else {
          shouldListenRef.current = false;
          setIsListening(false);
          if (err.error === 'not-allowed') {
            setJarvisFeedback('❌ Permission Denied: Microphone access was blocked by your browser.');
            showNotification('⚠️ Microphone access blocked. Check browser permissions.');
          } else {
            setJarvisFeedback(`❌ Speech error: ${err.error}`);
          }
        }
      };

      rec.onend = () => {
        if (shouldListenRef.current) {
          try {
            rec.start();
          } catch(e) {
            setIsListening(false);
            shouldListenRef.current = false;
          }
        } else {
          setIsListening(false);
          setJarvisFeedback('⏸ Stopped voice input. Type or click mic to talk.');
        }
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Load and sync Orion state on mount/user change from Supabase
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    const loadStateFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('orion_chats')
          .select('*')
          .eq('user_id', currentUser.uid)
          .eq('prompt', '__orion_state__')
          .limit(1);
          
        if (data && data.length > 0) {
          const stateData = JSON.parse(data[0].response);
          if (stateData.searchQuery !== undefined) setSearchQuery(stateData.searchQuery);
          if (stateData.searchResults !== undefined) setSearchResults(stateData.searchResults);
          if (stateData.searchSources !== undefined) setSearchSources(stateData.searchSources);
          if (stateData.generatedNotesContent !== undefined) setGeneratedNotesContent(stateData.generatedNotesContent);
          if (stateData.activeJarvisSection !== undefined) setActiveJarvisSection(stateData.activeJarvisSection);
          if (stateData.jarvisFeedback !== undefined) setJarvisFeedback(stateData.jarvisFeedback);
          console.log('[Supabase State Sync] Orion state loaded from Supabase successfully.');
        }
      } catch (err) {
        console.error('[Supabase State Sync] Error loading Orion state:', err);
      }
    };
    
    loadStateFromSupabase();
  }, [currentUser]);

  // Save Orion state on change to Supabase (debounced)
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    const delayDebounceFn = setTimeout(async () => {
      try {
        const stateData = {
          searchQuery,
          searchResults,
          searchSources,
          generatedNotesContent,
          activeJarvisSection,
          jarvisFeedback
        };
        
        const { data: existing } = await supabase
          .from('orion_chats')
          .select('id')
          .eq('user_id', currentUser.uid)
          .eq('prompt', '__orion_state__')
          .limit(1);
          
        if (existing && existing.length > 0) {
          await supabase
            .from('orion_chats')
            .update({
              response: JSON.stringify(stateData),
              timestamp: new Date().toISOString()
            })
            .eq('id', existing[0].id);
        } else {
          await supabase
            .from('orion_chats')
            .insert([{
              id: crypto.randomUUID(),
              user_id: currentUser.uid,
              prompt: '__orion_state__',
              response: JSON.stringify(stateData),
              timestamp: new Date().toISOString()
            }]);
        }
      } catch (err) {
        console.error('[Supabase State Sync] Error saving Orion state:', err);
      }
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(delayDebounceFn);
  }, [currentUser, searchQuery, searchResults, searchSources, generatedNotesContent, activeJarvisSection, jarvisFeedback]);

  // Load Orion chat history
  useEffect(() => {
    if (!currentUser?.uid) return;
    const fetchChatHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('orion_chats')
          .select('*')
          .eq('user_id', currentUser.uid)
          .order('timestamp', { ascending: true });
          
        if (data && data.length > 0) {
          const items: JarvisHistoryItem[] = data
            .filter((chat: any) => chat.prompt !== '__orion_state__')
            .map((chat: any) => ({
              id: chat.id,
              prompt: chat.prompt,
              response: chat.response,
              timestamp: chat.timestamp || new Date().toISOString(),
              actionExecuted: 'general_chat'
            }));
          setHistoryItems(items);
        }
      } catch (err) {
        console.error("Failed to load Orion history", err);
      }
    };
    fetchChatHistory();
  }, [currentUser]);

  // Load diagnostic statistics and commands from Supabase
  useEffect(() => {
    if (!currentUser) return;

    // Loaded directly from Supabase

    // Load registered users and aggregate them for real-time analytics reports
    fetchAllSupabaseUsers().then(users => {
      const studentUsers = users.filter(u => u.role === 'student');
      
      // 1. Map to StudentReport
      const reportsList: StudentReport[] = studentUsers.map(s => ({
        id: s.uid,
        name: s.name,
        classGrade: s.grade || 'Grade 10',
        section: (s.section || 'Ruby') as any,
        house: (s.house || 'Ruby') as any,
        streakDays: s.streakDays || 5,
        materialsUploaded: s.quizzesTaken || 3,
        notesCreated: s.studyHours || 8,
        quizzesCompleted: s.quizzesTaken || 5,
        assignmentsCompleted: 4,
        communityContributions: 12,
        recentActivity: [
          'Completed Physics MCQ assignment',
          'Shared study guide for organic chemistry',
          'Drew diagram on smartboard'
        ]
      }));
      setReports(reportsList);

      // 2. Map to HouseAnalytics
      const houseList = ['Ruby', 'Emerald', 'Sapphire', 'Topaz'];
      const mappedHouses: HouseAnalytics[] = houseList.map(h => {
        const matchingStudents = studentUsers.filter(s => s.house === h);
        const pts = matchingStudents.length * 150 + 100;
        return {
          id: h as any,
          points: pts,
          materialsShared: matchingStudents.length * 2,
          quizzesWon: matchingStudents.length * 3,
          participation: 85
        };
      });
      setHouses(mappedHouses);

      // 3. Map to SectionAnalytics
      const sectionList = ['Ruby', 'Astra', 'Solara', 'Vega'];
      const mappedSections: SectionAnalytics[] = sectionList.map(sec => {
        const matchingStudents = studentUsers.filter(s => s.section === sec);
        return {
          id: sec as any,
          totalStudents: matchingStudents.length || 2,
          studyActivity: 74,
          quizScores: 82,
          materialContributions: matchingStudents.length * 3
        };
      });
      setSections(mappedSections);
    }).catch(err => {
      console.error('Error in Jarvis Supabase loading:', err);
    });

    // Fetch commands from Supabase
    (async () => {
      try {
        const { data, error } = await supabase
          .from('teacher_commands')
          .select('*')
          .eq('teacher_id', currentUser.uid)
          .order('created_at', { ascending: false })
          .limit(20);

        if (data && !error) {
          const mapped: TeacherCommand[] = data.map((item: any) => ({
            id: item.id,
            commandText: item.command || item.command_text,
            recognizedAt: item.created_at || item.recognized_at,
            parsedAction: item.parsed_action,
            status: item.status
          }));
          setCommandAudit(mapped);
        }
      } catch (err) {
        console.warn('Teacher commands fetch notice:', err);
      }
    })();
  }, [currentUser]);



  const toggleListening = async () => {
    if (!recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || (window as any).msSpeechRecognition;
      if (!SpeechRecognition) {
        showNotification('⚠️ Your browser does not support Speech Recognition. Please try Google Chrome.');
        setJarvisFeedback('❌ Speech recognition not supported on this browser.');
        return;
      }
    }

    if (isListening) {
      shouldListenRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch(e) {}
      setIsListening(false);
      setJarvisFeedback('⏸ Stopped voice input.');
      showNotification('🎙️ Voice input stopped.');
    } else {
      setJarvisFeedback('🎤 Initializing microphone...');
      try {
        shouldListenRef.current = true;
        recognitionRef.current.start();
        showNotification('🎙️ Microphone active. Speak now!');
      } catch (e) {
        console.error("Start recognition failed:", e);
        setIsListening(false);
        shouldListenRef.current = false;
        setJarvisFeedback('❌ Failed to start speech recognition. Try clicking again.');
      }
    }
  };

  // Speaks feedback aloud using browser speech synth if available
  const speakFeedback = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }, 50);
    }
  };

  // --- PHASE 2 CORE INTEGRATED ENGINES ---
  const handleRunInternetSearch = async (query: string) => {
    if (!query || !query.trim()) return;
    setSearching(true);
    setSearchQuery(query);
    setActiveJarvisSection('search');
    setGeneratedNotesContent(null);
    
    // Display Coming Soon notice cleanly
    setTimeout(() => {
      setSearchResults(`🚀 **Web Search — Coming Soon**\n\nOnline search capabilities and live internet grounding will arrive in a future StudentOS update.`);
      setSearchSources([]);
      setSearching(false);
    }, 300);
  };

  const handleRunResourceDiscovery = async (query: string) => {
    if (!query || !query.trim()) return;
    setSearching(true);
    setSearchQuery(query);
    setActiveJarvisSection('search');
    try {
      // 1. Local database query
      const { data: matchedMaterials, error } = await supabase
        .from('materials')
        .select('*')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(10);

      if (matchedMaterials && !error) {
        setLocalMaterials(matchedMaterials);
      } else {
        setLocalMaterials([]);
      }

      // 2. AI Recommendation
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are an academic discovery engine. Based on the topic "${query}", list 4 highly recommended learning resources (e.g., active experiments, scientific papers, specific web articles) with bulleted descriptions.`,
          persona: 'study_buddy',
          level: 'Secondary',
          mode: 'explanatory',
          userId: currentUser?.uid || 'guest',
          userRole: currentUser?.role || 'student'
        })
      });
      if (!response.ok) {
        if (response.status === 429) {
          const errData = await response.json();
          throw new Error(errData.message || 'Daily AI message limit reached.');
        }
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      setSearchResults(data.text || "No recommendations compiled.");
    } catch (err: any) {
      console.error("Resource discovery failed:", err);
      setSearchResults(err.message?.includes('limit') ? `⚠️ ${err.message}` : "Connection offline. Check Material Hub for local copies. Alternatively, try reloading the page.");
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateLessonPlan = async (topic: string) => {
    if (!topic || !topic.trim()) return;
    setSearching(true);
    setSearchQuery(topic);
    setActiveJarvisSection('search');
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are an expert curriculum supervisor. Create a structured 1-hour study lesson plan block for: "${topic}". Include Timing, Activities, and Learning objectives.`,
          persona: 'study_buddy',
          level: 'Secondary',
          mode: 'explanatory',
          userId: currentUser?.uid || 'guest',
          userRole: currentUser?.role || 'student'
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      setSearchResults(data.text || "No plan compiled.");
      
      // Dispatch a CustomEvent to automatically add to the study planner
      const planEvent = new CustomEvent('s_os_add_schedule', {
        detail: {
          subject: topic.substring(0, 30),
          day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][new Date().getDay() - 1] || 'Monday',
          time: '14:00 - 15:00'
        }
      });
      window.dispatchEvent(planEvent);
    } catch (err) {
      console.error("Lesson planner failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateSpecializedNotes = async (topic: string, type: 'detailed_notes' | 'chapter_summary' | 'exam_prep' | 'formula_sheet' | 'revision_notes') => {
    if (!topic || !topic.trim()) return;
    setSearching(true);
    setSearchQuery(topic);
    setActiveJarvisSection('search');
    
    const typeLabels = {
      detailed_notes: 'Comprehensive Lecture Notes',
      chapter_summary: 'Chapter Summary',
      exam_prep: 'Exam Preparation Notes',
      formula_sheet: 'Formula Sheet',
      revision_notes: 'Revision Notes'
    };

    setSearchResults(`Querying Orion Notes Generator engine... Synthesizing ${typeLabels[type]} for "${topic}"...`);
    setSearchSources([]);
    setGeneratedNotesContent(null);
    setIsNotesSaved(false);

    try {
      let prompt = '';
      if (type === 'detailed_notes') {
        prompt = `Write a comprehensive, highly detailed academic lecture note about "${topic}".
        Provide exhaustive definitions, historical context, key theories, practical applications, and examples.
        Format beautifully with headings, subheadings, bullet points, and italic highlights.`;
      } else if (type === 'chapter_summary') {
        prompt = `Synthesize a structured chapter summary for the topic: "${topic}".
        Include a high-level executive summary, a timeline or sequence of core concepts, a breakdown of primary sub-chapters, and quick-glance checklists.`;
      } else if (type === 'exam_prep') {
        prompt = `Create an elite high-yield exam preparation notes package for: "${topic}".
        Highlight high-probability exam topics, sample questions with model answers, list standard student mistakes to avoid, and provide test-taking strategies.`;
      } else if (type === 'formula_sheet') {
        prompt = `Design a comprehensive formula sheet, derivations, and mathematical/scientific cheat-sheet for: "${topic}".
        List all relevant equations, variables, constant values, step-by-step mathematical proofs or conceptual derivations, and sample solving workflows.`;
      } else if (type === 'revision_notes') {
        prompt = `Write quick-recall, ultra-compact revision notes and memory scaffolds for: "${topic}".
        Use tables, numbered summaries, active recall questions, and mnemonic associations.`;
      }

      const response = await fetch('/api/ai/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: prompt,
          action: 'generate_notes'
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      const content = data.text || `# ${typeLabels[type]}: ${topic}\n\nNotes failed to generate.`;
      
      setSearchResults(content);
      
      const newNotesContent = { title: `${topic} (${typeLabels[type]})`, content: content };
      setGeneratedNotesContent(newNotesContent);
      
      // Automatically save to vault as requested
      if (createVaultNote) {
        createVaultNote(
          newNotesContent.title,
          newNotesContent.content,
          'Orion Generated'
        );
        setIsNotesSaved(true);
        showNotification(`✓ Orion automatically saved your generated "${typeLabels[type]}" to Lecture Notes Vault!`);
      } else {
        showNotification(`✓ Orion drafted your "${typeLabels[type]}" packet. Click "Save to Lecture Notes" below to save to your Vault!`);
      }
    } catch (err) {
      console.error("Specialized notes generation failed:", err);
      setSearchResults("Error: Notes generation failed.");
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateNotes = async (topic: string) => {
    await handleGenerateSpecializedNotes(topic, 'detailed_notes');
  };

  const handleSaveGeneratedNotesToVault = () => {
    if (!generatedNotesContent) return;
    
    if (createVaultNote) {
      createVaultNote(
        generatedNotesContent.title.substring(0, 40) + ' Notes',
        generatedNotesContent.content,
        'Orion Generated'
      );
    } else {
      // Fallback
      const noteEvent = new CustomEvent('s_os_create_note', {
        detail: {
          title: generatedNotesContent.title.substring(0, 40) + ' Notes',
          content: generatedNotesContent.content,
          subject: 'Orion Generated'
        }
      });
      window.dispatchEvent(noteEvent);
    }
    
    setIsNotesSaved(true);
    showNotification(`✓ Successfully saved "${generatedNotesContent.title}" packet to your Lecture Notes Vault!`);
  };

  // Perform AI parsing fallback with Gemini/OpenRouter using our robust Express server
  const queryJarvisAIStream = async (command: string): Promise<{ responseText: string; action: string; targetValue?: string; details?: any }> => {
    try {
      const cmdLow = command.toLowerCase().trim();

      // Explicit Web Search intent detection
      const isSearchQuery = (
        cmdLow.startsWith('search ') ||
        cmdLow.startsWith('look up ') ||
        cmdLow.startsWith('find information about ') ||
        cmdLow.startsWith('web search ') ||
        cmdLow.startsWith('search online ') ||
        cmdLow.includes('search about ') ||
        cmdLow.includes('search the web for ') ||
        cmdLow.includes('search online for ') ||
        cmdLow.includes('look up information about ')
      );

      if (isSearchQuery) {
        let queryStr = cmdLow
          .replace(/^search\s+(about|for|the\s+web\s+for|online\s+for)?\s*/gi, '')
          .replace(/^look\s+up\s+(information\s+about|info\s+about)?\s*/gi, '')
          .replace(/^find\s+information\s+about\s*/gi, '')
          .replace(/^web\s+search\s*/gi, '')
          .replace(/^search\s+online\s+(for)?\s*/gi, '')
          .trim();

        return {
          responseText: "🚀 **Web Search — Coming Soon**\n\nOnline web search capabilities and live internet grounding will arrive in a future StudentOS update.",
          action: "web_search",
          targetValue: queryStr || command,
          details: { query: queryStr || command }
        };
      }

      let aiText = '';
      
      // Build RAG Context from StudentOS with correct materials schema
      const { data: materialsData } = await supabase.from('materials').select('title, category, description').limit(5);
      const ragContext = materialsData ? materialsData.map((m: any) => `[${m.category}] ${m.title}: ${m.description ? m.description.substring(0, 100) : ''}`).join('\n') : 'No local resources found.';

      const systemPrompt = `You are StudentOS Orion, the advanced School Operating Assistant AI Engine.
The user typed or spoke this command: "${command}".

Analyze the input and classify into ONE of these operational actions:
- "send_broadcast" (broadcast, announce school-wide, tell everyone)
- "notify_users" (notify all teachers, notify class 10, notify students)
- "create_study_plan" (create study plan, make study plan, plan study for exams, study schedule)
- "create_calendar_event" (add to calendar, add event to calendar, add holiday, add exam date)
- "create_note" (create note, save note to vault, take note)
- "mark_attendance" (take attendance, mark attendance, record attendance)
- "create_event" (schedule annual function, schedule event, schedule assembly)
- "create_competition" (create competition, create coding competition, create sports competition)
- "create_meet" (schedule StudentOS Meet, schedule meeting)
- "create_homework" (create homework, create assignment)
- "create_notice" (upload notice, create notice)
- "delete_item" (delete competition, delete event, cancel meeting, delete homework)
- "web_search" (search online, look up information)
- "general_chat" (general conversation or question)

Your response MUST be raw JSON format with NO markdown wrapping:
{
  "responseText": "Summary response in friendly, clear markdown. If performing an operation, state what was executed.",
  "action": "action_name",
  "targetValue": "Main entity title, topic, or search query",
  "details": {
    "title": "extracted title or topic",
    "date": "extracted date or YYYY-MM-DD",
    "time": "extracted time like 09:00 AM",
    "targetAudience": "all / Class 10 / teachers / students",
    "category": "Academic / Cultural / Technology / General",
    "content": "message or description content"
  }
}`;

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: systemPrompt,
            persona: 'orion',
            level: 'Secondary',
            mode: 'explanatory',
            history: historyItems.map(item => ({ role: 'user', content: item.prompt })).flatMap(u => [u, { role: 'assistant', content: '...' }]).slice(-6),
            ragContext: ragContext,
            userId: currentUser?.uid || 'guest',
            userRole: currentUser?.role || 'student'
          })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        aiText = data.text;
      } catch (apiErr: any) {
        console.warn("Server API failed for Orion completion:", apiErr.message || apiErr);
        const { clientSideGemini } = await import('../lib/clientAiFallback');
        aiText = await clientSideGemini(systemPrompt);
      }
      
      const cleanJsonString = (raw: string): string => {
        let cleaned = raw.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        }
        return cleaned.trim();
      };

      try {
        const cleanedStr = cleanJsonString(aiText);
        const parsed = JSON.parse(cleanedStr);
        if (parsed && typeof parsed === 'object') {
          return {
            responseText: parsed.responseText || parsed.response || aiText,
            action: parsed.action || parsed.intent || 'general_chat',
            targetValue: parsed.targetValue || parsed.details?.title || parsed.details?.query,
            details: parsed.details || {}
          };
        }
      } catch (e) {
        console.warn('Structured JSON parsing notice:', e, 'Raw:', aiText?.slice(0, 100));
      }

      return {
        responseText: (aiText && aiText.trim().length > 0) ? aiText : `I'm ready to assist you. Let me know what you'd like to automate across StudentOS!`,
        action: 'general_chat'
      };
    } catch (err: any) {
      console.error('Orion remote parsing failed:', err);
      return {
        responseText: `I'm ready to assist you. Let me know what you'd like to automate across StudentOS!`,
        action: 'general_chat'
      };
    }
  };

  // Command Parser & Executor (Orion 2.0 Operating Assistant)
  const mapActionNameToType = (aiAction: string, textLow: string): OrionActionType => {
    if (aiAction === 'web_search' || textLow.includes('search about') || textLow.includes('search the web') || textLow.startsWith('look up')) return 'web_search';
    if (aiAction === 'create_study_plan' || textLow.includes('create study plan') || textLow.includes('make a study plan') || textLow.includes('plan study') || textLow.includes('study plan for')) return 'create_study_plan';
    if (aiAction === 'create_calendar_event' || (textLow.includes('calendar') && (textLow.includes('add') || textLow.includes('schedule') || textLow.includes('event')))) return 'create_calendar_event';
    if (aiAction === 'create_note' || textLow.includes('save note') || textLow.includes('take note') || (textLow.includes('note') && textLow.includes('vault'))) return 'create_note';
    if (aiAction === 'mark_attendance' || aiAction === 'start_attendance' || textLow.includes('attendance') && (textLow.includes('take') || textLow.includes('mark') || textLow.includes('start'))) return 'mark_attendance';
    if (aiAction === 'send_broadcast' || textLow.includes('broadcast')) return 'create_broadcast';
    if (aiAction === 'notify_users' || textLow.includes('notify') || textLow.includes('tell class')) return 'notify_users';
    if (aiAction === 'create_event' || textLow.includes('schedule event') || textLow.includes('annual function') || textLow.includes('schedule assembly')) return 'create_event';
    if (aiAction === 'create_competition' || textLow.includes('competition')) return 'create_competition';
    if (aiAction === 'create_meet' || (textLow.includes('schedule') && textLow.includes('meet'))) return 'create_meeting';
    if (aiAction === 'add_study_planner' || textLow.includes('study planner') || textLow.includes('study session')) return 'add_study_planner';
    if (aiAction === 'add_task' || (textLow.includes('task') && (textLow.includes('add') || textLow.includes('create') || textLow.includes('new')))) return 'add_task';
    if (aiAction === 'complete_task' || (textLow.includes('task') && (textLow.includes('mark') || textLow.includes('complete') || textLow.includes('done')))) return 'complete_task';
    if (aiAction === 'delete_task' || (textLow.includes('task') && textLow.includes('delete'))) return 'delete_task';
    if (aiAction === 'create_homework' || textLow.includes('homework') || textLow.includes('assignment')) return 'create_homework';
    if (aiAction === 'delete_item' || textLow.startsWith('delete') || textLow.startsWith('cancel') || textLow.startsWith('remove')) return 'delete_item';
    if (aiAction === 'register_competition') return 'register_competition';
    return (aiAction as OrionActionType) || 'general_chat';
  };

  const parseMultiStepActions = (rawText: string, primary: OrionAction): OrionAction[] => {
    const lower = rawText.toLowerCase();
    const actions: OrionAction[] = [primary];

    // Compound intent for Study Planner AND Task Manager
    if (lower.includes('study planner') && (lower.includes('task') || lower.includes('tasks'))) {
      if (!actions.some(a => a.action === 'add_study_planner')) {
        actions.push({ action: 'add_study_planner', title: primary.title || primary.targetValue, date: primary.date, time: primary.time });
      }
      if (!actions.some(a => a.action === 'add_task')) {
        actions.push({ action: 'add_task', title: primary.title || primary.targetValue, date: primary.date });
      }
    }

    if ((lower.includes('competition') || lower.includes('event') || lower.includes('meet') || lower.includes('assignment')) &&
        (lower.includes(' and notify ') || lower.includes(' and tell ') || lower.includes(' and send notification'))) {
      const classMatch = lower.match(/class\s+(\d+[a-z]?)/i);
      actions.push({
        action: 'notify_users',
        title: `📢 Alert regarding ${primary.title || 'new update'}`,
        message: `Update: ${primary.title || rawText}`,
        audience: classMatch ? `Class ${classMatch[1].toUpperCase()}` : 'all',
        targetClass: classMatch ? `Class ${classMatch[1].toUpperCase()}` : undefined
      });
    }

    return actions;
  };

  const executeVoiceCommand = async (textToParse: string) => {
    if (!textToParse.trim()) return;
    setIsProcessing(true);
    let textLow = textToParse.toLowerCase().trim();

    // 1. Check if user is confirming or canceling a pending action
    if (pendingConfirmation) {
      const confirmAffirmatives = ['yes', 'confirm', 'proceed', 'sure', 'do it', 'delete', 'ok', 'yeah', 'cancel meeting', 'delete competition'];
      const confirmNegatives = ['no', 'cancel', 'dont', "don't", 'abort', 'stop', 'keep it'];

      if (confirmAffirmatives.some(k => textLow.includes(k))) {
        const userCtx: OrionUserContext = {
          userId: currentUser?.uid,
          userName: currentUser?.name || 'User',
          userEmail: currentUser?.email,
          userRole: effectiveRole || 'student'
        };

        const actionToExec: OrionAction = {
          action: pendingConfirmation.action as any,
          title: pendingConfirmation.targetValue,
          targetValue: pendingConfirmation.targetValue
        };

        const execRes = await executeOrionActionPipeline([actionToExec], userCtx, textToParse, true);
        setPendingConfirmation(null);
        setJarvisFeedback(execRes.combinedSummary);
        speakFeedback(execRes.combinedSummary);
        showNotification(`SYSTEM: Confirmed execution of ${pendingConfirmation.targetValue}`);
        setIsProcessing(false);
        return;
      } else if (confirmNegatives.some(k => textLow.includes(k))) {
        setPendingConfirmation(null);
        const cancelText = 'Operation canceled. No changes were made to StudentOS.';
        setJarvisFeedback(cancelText);
        speakFeedback(cancelText);
        setIsProcessing(false);
        return;
      }
    }

    // 2. Resolve Context Pronouns ("it", "that") using lastEntityRef
    if ((textLow.includes(' it ') || textLow.endsWith(' it') || textLow.includes(' that ')) && lastEntityRef.current) {
      textToParse = textToParse.replace(/\b(it|that)\b/gi, lastEntityRef.current.title);
      textLow = textToParse.toLowerCase().trim();
    }

    // Super Admin trigger
    if (textLow.includes('naitik kashyap') || textLow.includes('super admin protocol')) {
      if (effectiveRole === 'super_admin') {
        setJarvisFeedback('Super Admin credentials verified via Firestore role. Control Center activated.');
        speakFeedback('Super Admin credentials verified.');
        if (onSuperAdminUnlocked) onSuperAdminUnlocked();
        showNotification('SYSTEM: Super Admin Mode Activated.');
      } else {
        setJarvisFeedback('Access Denied: You lack the required Super Admin Firestore role.');
        speakFeedback('Access Denied.');
        showNotification('SYSTEM: Auth Failed.');
      }
      setIsProcessing(false);
      return;
    }

    // Query Orion AI Operating Engine for classification
    const aiVerdict = await queryJarvisAIStream(textToParse);
    const details = aiVerdict.details || {};
    const targetVal = aiVerdict.targetValue || details.title || textToParse;

    // Construct primary action
    const mappedAction = mapActionNameToType(aiVerdict.action, textLow);
    const primaryAction: OrionAction = {
      action: mappedAction,
      title: details.title || targetVal,
      message: details.content || textToParse,
      content: details.content || textToParse,
      subject: details.subject || 'General Studies',
      category: details.category || 'General',
      audience: details.targetAudience || 'all',
      targetClass: details.targetClass || 'Grade 10',
      date: details.date,
      time: details.time,
      targetValue: targetVal,
      details
    };

    // Check for multi-step instructions
    const actionList = parseMultiStepActions(textToParse, primaryAction);

    const userCtx: OrionUserContext = {
      userId: currentUser?.uid,
      userName: currentUser?.name || 'User',
      userEmail: currentUser?.email,
      userRole: effectiveRole || 'student'
    };

    // Execute through Centralized Action Executor Pipeline
    const pipelineRes = await executeOrionActionPipeline(actionList, userCtx, textToParse, false);

    if (pipelineRes.pendingConfirmation) {
      setPendingConfirmation({
        action: pipelineRes.pendingConfirmation.action,
        targetValue: pipelineRes.pendingConfirmation.targetTitle,
        promptText: pipelineRes.pendingConfirmation.promptText
      });
    }

    let resolvedFeedback = pipelineRes.combinedSummary;
    let actionTriggered = mappedAction;

    // View / Tab Navigation Helpers
    if (mappedAction === 'show_pending_assignments' || textLow.includes('pending assignment')) {
      setActiveTab('assignments');
    } else if (mappedAction === 'show_timetable' || textLow.includes('timetable')) {
      setActiveTab('timetable_viewer');
    } else if (mappedAction === 'show_attendance' || mappedAction === 'start_attendance' || textLow.includes('attendance')) {
      setActiveTab('attendance_manager');
    } else if (mappedAction === 'show_announcements' || textLow.includes('notice')) {
      setActiveTab('notice_viewer');
    } else if (textLow.includes('studentos life') || textLow.includes('open life')) {
      setActiveTab('life' as any);
    } else if (textLow.includes('studentos meet') || textLow.includes('open meet')) {
      setActiveTab('meet' as any);
    } else if (mappedAction === 'navigate_tab' && targetVal) {
      const tabVal = targetVal.toLowerCase();
      if (tabVal.includes('life')) setActiveTab('life' as any);
      else if (tabVal.includes('meet')) setActiveTab('meet' as any);
      else if (tabVal.includes('fun')) setActiveTab('funzone' as any);
      else if (tabVal.includes('assignment')) setActiveTab('assignments');
      else if (tabVal.includes('attendance')) setActiveTab('attendance_manager');
      else if (tabVal.includes('timetable') || tabVal.includes('schedule')) setActiveTab('timetable_viewer');
      else if (tabVal.includes('notice') || tabVal.includes('announcement')) setActiveTab('notice_viewer');
    } else if (mappedAction === 'search_internet') {
      handleRunInternetSearch(targetVal);
    } else if (mappedAction === 'generate_notes') {
      setActiveTab('notes');
      handleGenerateNotes(targetVal);
    } else if (mappedAction === 'generate_lesson_plan') {
      setActiveTab('planner');
      handleGenerateLessonPlan(targetVal);
    }

    setJarvisFeedback(resolvedFeedback);
    speakFeedback(resolvedFeedback);
    showNotification(`ORION: ${actionTriggered} processed.`);

    // Log command audit
    const newAuditItem: TeacherCommand = {
      id: `audit-${Date.now()}`,
      commandText: textToParse,
      recognizedAt: new Date().toISOString(),
      parsedAction: actionTriggered,
      status: 'success'
    };

    setCommandAudit(prev => [newAuditItem, ...prev].slice(0, 20));

    try {
      if (currentUser?.uid) {
        await supabase.from('orion_chats').insert([{
          id: crypto.randomUUID(),
          user_id: currentUser.uid,
          prompt: textToParse,
          response: resolvedFeedback,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (e) {
      console.error('Failed logging audit:', e);
    }

    // Close panel seamlessly on UI navigation triggers
    const navActions = ['navigate_tab', 'search_materials', 'explain_concept', 'generate_quiz', 'close_orion'];
    if (navActions.includes(actionTriggered) && onClose) {
      setTimeout(() => {
        onClose();
      }, 1500);
    }

    setIsProcessing(false);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeVoiceCommand(commandText);
  };

  // Quick Action triggers for smart board touch use
  const handleQuickTouchAction = (cmd: string) => {
    setCommandText(cmd);
    executeVoiceCommand(cmd);
  };

  // Filter student lists
  const filteredReports = reports.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchStudentTerm.toLowerCase()) || 
                          r.classGrade.toLowerCase().includes(searchStudentTerm.toLowerCase());
    const matchesHouse = statusFilter ? r.house === statusFilter || r.section === statusFilter : true;
    return matchesSearch && matchesHouse;
  });

  return (
    <div className="flex flex-col justify-between overflow-hidden relative transition-all duration-300 h-full p-6">
      
      {/* 1. TOP HUD / HEADER */}
      <div className="flex items-center justify-between pb-6 border-b border-white/5 gap-4 flex-wrap relative">
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-0 right-0 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            title="Close Orion"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-3 pr-10">
          <div className="relative">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center animate-pulse">
              <span className="text-xl">🎙️</span>
            </div>
            {isListening && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 animate-ping border border-slate-950" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black font-display text-white tracking-widest uppercase">StudentOS Orion</h2>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono uppercase font-bold">Teacher Copilot v2.8</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Vocally driving smart-board operations & school intelligence feeds</p>
          </div>
        </div>

        {/* Sections Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button 
            onClick={() => setActiveJarvisSection('home')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
              activeJarvisSection === 'home' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-white'
            }`}
          >
            <Layout className="w-3 h-3" /> Dashboard
          </button>
          <button 
            onClick={() => setActiveJarvisSection('reports')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
              activeJarvisSection === 'reports' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-white'
            }`}
          >
            <Users className="w-3 h-3" /> Student Reports
          </button>
          <button 
            onClick={() => setActiveJarvisSection('houses')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
              activeJarvisSection === 'houses' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-white'
            }`}
          >
            <Award className="w-3 h-3" /> Houses
          </button>
          <button 
            onClick={() => setActiveJarvisSection('sections')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
              activeJarvisSection === 'sections' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3 h-3" /> Sections
          </button>
          <button 
            onClick={() => setActiveJarvisSection('history')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
              activeJarvisSection === 'history' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-white'
            }`}
          >
            <Terminal className="w-3 h-3" /> Voice Log
          </button>
          
          <button 
            onClick={() => setActiveJarvisSection('search')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
              activeJarvisSection === 'search' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-white'
            }`}
          >
            <Search className="w-3 h-3" /> Discovery Hub
          </button>
          
          <button 
            onClick={() => setShowDiagnostics(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
              showDiagnostics ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-white hover:border-emerald-500/30'
            }`}
          >
            <Mic className="w-3 h-3" /> Diagnostics
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          {/* Sizing & Close tools */}
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle fullscreen smart-board layout"
            className="p-1 px-2 rounded-lg bg-slate-950/45 text-slate-400 hover:text-white border border-white/5 text-[10px] uppercase font-bold"
          >
            {isFullscreen ? 'Exit Full' : 'Fullscreen'}
          </button>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. BODY GRAPHICS PANELS */}
      <div className="flex-1 overflow-y-auto py-4 pr-1 min-h-0 space-y-4">
        
        {/* A. GENERAL DOCK (ACTIVE LISTEN / INSTRUCTIONS) */}
        <div className="smart-glass p-4 rounded-2xl bg-slate-950/45 border border-indigo-500/10 flex items-start gap-3 relative overflow-hidden backdrop-blur-md">
          {/* Neon background light flare */}
          <div className="absolute right-0 top-0 h-20 w-20 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="h-8 w-8 rounded-full bg-indigo-500/25 border border-indigo-400/35 flex items-center justify-center text-indigo-300 mt-0.5 flex-shrink-0 animate-pulse">
            <Volume2 className="w-4 h-4" />
          </div>
          <div className="space-y-1.5 flex-1 select-text">
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Orion Guidance System</span>
            <p className="text-xs text-slate-350 leading-relaxed font-sans">{jarvisFeedback}</p>
            {isListening && (
              <div className="flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 py-1 px-2.5 rounded-lg text-[10px] font-bold w-fit animate-pulse font-mono">
                <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-ping" />
                Orion Listening... Please speak your command clearly
              </div>
            )}
          </div>
        </div>

        {/* Pending Confirmation Banner */}
        {pendingConfirmation && (
          <div className="smart-glass p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-xs font-bold text-amber-300 font-mono">CONFIRMATION REQUIRED</p>
                <p className="text-xs text-slate-200 mt-0.5">{pendingConfirmation.promptText}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => executeVoiceCommand('yes')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-lg cursor-pointer"
              >
                Yes, Confirm
              </button>
              <button
                onClick={() => executeVoiceCommand('no')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* DIAGNOSTICS PANEL (New feature) */}
        {showDiagnostics && (
          <div className="smart-glass p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex flex-col gap-2 overflow-x-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-widest font-mono">Microphone Diagnostics</span>
              <button onClick={() => setShowDiagnostics(false)} className="text-rose-400 hover:text-white px-2 py-1 rounded bg-rose-500/20 text-[10px]">Close</button>
            </div>
            <div className="space-y-1.5 text-[10px] font-mono text-slate-300">
              <p><strong>Browser:</strong> {navigator.userAgent}</p>
              <p><strong>navigator.mediaDevices:</strong> {String(!!navigator.mediaDevices)}</p>
              <p><strong>getUserMedia:</strong> {String(!!navigator.mediaDevices?.getUserMedia)}</p>
              <p><strong>SpeechRecognition:</strong> {String(!!(window as any).SpeechRecognition)}</p>
              <p><strong>webkitSpeechRecognition:</strong> {String(!!(window as any).webkitSpeechRecognition)}</p>
              
              {diagnosticError && (
                <div className="mt-2 p-2 bg-red-950/50 border border-red-500/30 rounded text-red-200">
                  <p className="font-bold text-red-400 mb-1">Error Captured:</p>
                  <p><strong>Name:</strong> {diagnosticError.name}</p>
                  <p><strong>Message:</strong> {diagnosticError.message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* B. SECTION: HOME SMART BOARD TOUCH PANEL */}
        {activeJarvisSection === 'home' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Quick Touch Commander Column (Col: 7) */}
            <div className="md:col-span-7 space-y-3">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase font-mono tracking-wider block">🗣️ Classroom Command Deck (One-Touch Execution)</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                
                {/* Whiteboard commands */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-2">
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">🖌️ Whiteboard Touch Ops</span>
                  <div className="flex flex-col gap-1.5">
                    <button 
                      onClick={() => handleQuickTouchAction('Start whiteboard')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 text-left rounded-lg font-mono flex items-center justify-between group transition-all"
                    >
                      <span>Start whiteboard</span>
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-400 py-0.5 px-1.5 rounded uppercase group-hover:bg-indigo-500/20 font-bold">Go</span>
                    </button>
                    <button 
                      onClick={() => handleQuickTouchAction('Clear board')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 text-left rounded-lg font-mono flex items-center justify-between group transition-all"
                    >
                      <span>Clear board</span>
                      <span className="text-[8px] bg-red-500/10 text-red-400 py-0.5 px-1.5 rounded uppercase group-hover:bg-red-500/25 font-bold">Wipe</span>
                    </button>
                    <button 
                      onClick={() => handleQuickTouchAction('Save whiteboard')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 text-left rounded-lg font-mono flex items-center justify-between group transition-all"
                    >
                      <span>Save whiteboard</span>
                      <span className="text-[8px] bg-emerald-500/10 text-emerald-400 py-0.5 px-1.5 rounded uppercase group-hover:bg-emerald-500/25 font-bold">Export</span>
                    </button>
                  </div>
                </div>

                {/* AI teacher commands */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-2">
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">🎓 AI Subject Facilitation</span>
                  <div className="flex flex-col gap-1.5">
                    <button 
                      onClick={() => handleQuickTouchAction('Explain Newton\'s Laws')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 text-left rounded-lg font-mono flex items-center justify-between group transition-all"
                    >
                      <span>Explain Newton's Laws</span>
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-400 py-0.5 px-1.5 rounded uppercase group-hover:bg-indigo-500/20 font-bold">AI</span>
                    </button>
                    <button 
                      onClick={() => handleQuickTouchAction('Create a lesson plan')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 text-left rounded-lg font-mono flex items-center justify-between group transition-all"
                    >
                      <span>Create lesson plan</span>
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 py-0.5 px-1.5 rounded uppercase group-hover:bg-amber-500/25 font-bold">Plan</span>
                    </button>
                    <button 
                      onClick={() => handleQuickTouchAction('Generate MCQs')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 text-left rounded-lg font-mono flex items-center justify-between group transition-all"
                    >
                      <span>Generate MCQs</span>
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-400 py-0.5 px-1.5 rounded uppercase group-hover:bg-indigo-500/20 font-bold">Test</span>
                    </button>
                  </div>
                </div>

                {/* Material Hub & Navigation commands */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-2">
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">📁 Material Hub Directory</span>
                  <div className="flex flex-col gap-1.5">
                    <button 
                      onClick={() => handleQuickTouchAction('Open Material Hub')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 text-left rounded-lg font-mono flex items-center justify-between group transition-all"
                    >
                      <span>Open Material Hub</span>
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-400 py-0.5 px-1.5 rounded uppercase group-hover:bg-indigo-500/20 font-bold">Open</span>
                    </button>
                    <button 
                      onClick={() => handleQuickTouchAction('Open Physics materials')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 text-left rounded-lg font-mono flex items-center justify-between group transition-all"
                    >
                      <span>Open Physics materials</span>
                      <span className="text-[8px] bg-teal-500/10 text-teal-400 py-0.5 px-1.5 rounded uppercase group-hover:bg-teal-500/25 font-bold">Search</span>
                    </button>
                  </div>
                </div>

                {/* Ledger & School reports */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-2">
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">📈 Ledger & Statistics</span>
                  <div className="flex flex-col gap-1.5">
                    <button 
                      onClick={() => handleQuickTouchAction('Show student reports')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 text-left rounded-lg font-mono flex items-center justify-between group transition-all"
                    >
                      <span>Show student reports</span>
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 py-0.5 px-1.5 rounded uppercase group-hover:bg-amber-500/25 font-bold">View</span>
                    </button>
                    <button 
                      onClick={() => handleQuickTouchAction('Show Aditya\'s report')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 text-left rounded-lg font-mono flex items-center justify-between group transition-all"
                    >
                      <span>Show Aditya's report</span>
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-400 py-0.5 px-1.5 rounded uppercase group-hover:bg-indigo-500/20 font-bold">Card</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Live Standings Summary Panel (Col: 5) */}
            <div className="md:col-span-5 space-y-3">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase font-mono tracking-wider block">🏆 Inter-House Championship Summary</span>
              
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-3">
                {houses.length > 0 ? (
                  <div className="space-y-2">
                    {houses.map((house, idx) => (
                      <div 
                        key={house.id} 
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900 transition-colors border border-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400">{idx+1}.</span>
                          <span className={`text-xs font-black font-display uppercase ${
                            house.id === 'Ruby' ? 'text-red-400' : 
                            house.id === 'Emerald' ? 'text-emerald-400' :
                            house.id === 'Sapphire' ? 'text-indigo-400' : 'text-amber-450'
                          }`}>{house.id}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] text-slate-400"><BookOpen className="w-2.5 h-2.5 inline mr-1" /> {house.materialsShared} Docs</span>
                          <span className="text-xs font-bold text-white font-mono bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/25">{house.points} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs font-mono">Standings sync pending...</div>
                )}

                <div className="pt-2 border-t border-white/5 flex gap-2">
                  <button 
                    onClick={() => setActiveJarvisSection('houses')}
                    className="w-full text-center py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] uppercase font-black rounded-lg tracking-wider transition-colors border border-indigo-500/20"
                  >
                    Launch Full Standing Analytics
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                <span className="text-[10px] text-indigo-400 font-extrabold uppercase font-mono tracking-wider block">📡 Recent Orion Commands</span>
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {commandAudit.length > 0 ? (
                    commandAudit.slice(0, 8).map((cmd) => (
                      <div key={cmd.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-white/5 transition-colors">
                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cmd.status === 'success' ? 'bg-emerald-500 shadow-[0_0_5px_theme(colors.emerald.500)]' : 'bg-red-500 shadow-[0_0_5px_theme(colors.red.500)]'}`} />
                        <span className="text-[10px] text-slate-300 font-mono flex-1 truncate">{cmd.commandText}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[10px] text-slate-500 text-center py-4 italic bg-slate-900/40 rounded-xl">Tracking logs empty. Awaiting voice commands...</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* C. STUDENT REPORT DASHBOARD */}
        {activeJarvisSection === 'reports' && (
          <div className="space-y-4">
            
            {/* Header controls for reports */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950/45 p-3 rounded-2xl border border-white/5">
              <div className="space-y-0.5">
                <span className="text-[9px] text-indigo-400 font-extrabold uppercase font-mono tracking-wider block">Database Registry Node</span>
                <h3 className="text-xs font-black text-white font-display uppercase">Student Classroom Report Cards</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <input 
                  type="text" 
                  placeholder="Identify student..." 
                  value={searchStudentTerm}
                  onChange={e => setSearchStudentTerm(e.target.value)}
                  className="bg-slate-900 border border-white/10 text-xs px-3 py-1.5 rounded-xl text-white outline-none focus:border-indigo-500/50 w-full sm:w-44"
                />

                <select 
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-white/10 text-xs px-3 py-1.5 rounded-xl text-white outline-none focus:border-indigo-500/50"
                >
                  <option value="">All Filters</option>
                  <option value="Astra">Astra Section</option>
                  <option value="Elara">Elara Section</option>
                  <option value="Solara">Solara Section</option>
                  <option value="Vega">Vega Section</option>
                  <option value="Ruby">Ruby House</option>
                  <option value="Emerald">Emerald House</option>
                  <option value="Sapphire">Sapphire House</option>
                  <option value="Topaz">Topaz House</option>
                </select>
              </div>
            </div>

            {/* Main table list */}
            {selectedStudent ? (
              // Individual Student Report Focus Card
              <div className="smart-glass p-5 rounded-2xl bg-slate-950/60 border border-indigo-500/30 space-y-4 animate-scaleUp">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-slate-900 border-2 border-indigo-500/30 flex items-center justify-center text-xl">
                      🧑‍🎓
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white font-display uppercase tracking-wider">{selectedStudent.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {selectedStudent.classGrade} • {selectedStudent.section} Section • 
                        <span className={`font-black uppercase ml-1 ${
                          selectedStudent.house === 'Ruby' ? 'text-red-400' : 
                          selectedStudent.house === 'Emerald' ? 'text-emerald-400' :
                          selectedStudent.house === 'Sapphire' ? 'text-indigo-400' : 'text-amber-450'
                        }`}>{selectedStudent.house} House</span>
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedStudent(null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/5 text-[9px] uppercase font-black text-indigo-400 hover:text-indigo-300"
                  >
                    ← Back to Registry
                  </button>
                </div>

                {/* Score indicators grid */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Streak Tally</span>
                    <span className="text-lg font-black text-amber-500 font-mono">🔥 {selectedStudent.streakDays} Days</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Docs Uploaded</span>
                    <span className="text-lg font-black text-indigo-400 font-mono">📁 {selectedStudent.materialsUploaded}</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Notes Saved</span>
                    <span className="text-lg font-black text-teal-400 font-mono">📝 {selectedStudent.notesCreated}</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Quizzes Done</span>
                    <span className="text-lg font-black text-pink-400 font-mono">🎮 {selectedStudent.quizzesCompleted}</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Homework Done</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">✅ {selectedStudent.assignmentsCompleted}</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Contributions</span>
                    <span className="text-lg font-black text-amber-450 font-mono">🏆 {selectedStudent.communityContributions}</span>
                  </div>
                </div>

                {/* Recent activity list */}
                <div className="space-y-2">
                  <span className="text-[10px] text-indigo-400 font-extrabold uppercase font-mono tracking-wider block">🕒 Recent Academic Activity</span>
                  <div className="space-y-1">
                    {selectedStudent.recentActivity && selectedStudent.recentActivity.map((act, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/40 p-2 rounded-lg border border-white/5">
                        <span className="text-indigo-400 font-mono">▶</span>
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Student table register
              <div className="bg-slate-950/65 rounded-2xl border border-white/5 overflow-hidden">
                {filteredReports.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <div className="text-3xl">👥</div>
                    <p className="text-slate-300 font-extrabold uppercase font-display text-xs tracking-wider">No Student Analytics Found</p>
                    <p className="text-slate-500 font-mono text-[10px] max-w-md mx-auto">
                      There are currently no active student reports or academic tracking nodes linked to the system database.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-hidden">
                    <div className="hidden md:block">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900 border-b border-white/10 text-slate-450 uppercase tracking-wider text-[10px] font-black">
                            <th className="p-3">Student name</th>
                            <th className="p-3 text-center">House</th>
                            <th className="p-3 text-center">Section</th>
                            <th className="p-3 text-center">Streak</th>
                            <th className="p-3 text-center">Contributions</th>
                            <th className="p-3 text-center">Quizzes</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredReports.map(st => (
                            <tr key={st.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="p-3">
                                <div className="font-extrabold text-white uppercase font-display">{st.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{st.classGrade}</div>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`text-[10px] font-black uppercase inline-block px-2 py-0.5 rounded-full ${
                                  st.house === 'Ruby' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                  st.house === 'Emerald' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  st.house === 'Sapphire' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 
                                                           'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                }`}>
                                  {st.house}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono text-slate-350">{st.section}</td>
                              <td className="p-3 text-center font-mono text-amber-500 font-bold">🔥 {st.streakDays}d</td>
                              <td className="p-3 text-center font-mono text-indigo-400 font-bold">{st.communityContributions} pts</td>
                              <td className="p-3 text-center font-mono text-slate-400">{st.quizzesCompleted}</td>
                              <td className="p-3 text-right">
                                <button 
                                  onClick={() => setSelectedStudent(st)}
                                  className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold uppercase transition-transform hover:scale-105"
                                >
                                  Inspect
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Mobile Stacked Cards for Reports */}
                    <div className="md:hidden divide-y divide-white/5">
                      {filteredReports.map(st => (
                        <div key={st.id} className="p-4 space-y-3 hover:bg-slate-900/40 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-extrabold text-white uppercase font-display text-sm">{st.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{st.classGrade}</div>
                            </div>
                            <span className={`text-[9px] font-black uppercase inline-block px-2 py-0.5 rounded-full ${
                              st.house === 'Ruby' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                              st.house === 'Emerald' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              st.house === 'Sapphire' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 
                                                       'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}>
                              {st.house}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            <span className="bg-white/5 px-2 py-1 rounded border border-white/5 font-mono text-slate-400">Sec: {st.section}</span>
                            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded font-bold font-mono">🔥 {st.streakDays}d</span>
                            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded font-bold font-mono">{st.communityContributions} pts</span>
                          </div>
                          <button 
                            onClick={() => setSelectedStudent(st)}
                            className="w-full py-1.5 bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold uppercase transition-transform"
                          >
                            Inspect Profile Analytics
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* D. HOUSE ANALYTICS LEADERBOARD */}
        {activeJarvisSection === 'houses' && (
          <div className="space-y-4">
            <span className="text-[10px] text-indigo-400 font-extrabold uppercase font-mono tracking-wider block">💎 School House Championship Leaderboard</span>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {houses.map((house, index) => (
                <div 
                  key={house.id} 
                  className="smart-glass p-4 rounded-2xl bg-slate-950/60 border border-white/5 relative flex flex-col justify-between"
                >
                  {/* Rank Badge */}
                  <span className="absolute top-3 right-3 text-2xl font-mono opacity-25">#0{index+1}</span>
                  
                  <div className="space-y-1.5">
                    <span className={`text-base font-black font-display uppercase tracking-widest ${
                      house.id === 'Ruby' ? 'text-red-400' : 
                      house.id === 'Emerald' ? 'text-emerald-400' :
                      house.id === 'Sapphire' ? 'text-indigo-400' : 'text-amber-450'
                    }`}>{house.id}</span>
                    <p className="text-2xl font-black font-mono text-white tracking-tight">{house.points} <span className="text-[10px] text-slate-400 font-bold">pts</span></p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/5 space-y-1.5 text-[10px] font-mono text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>📁 Materials Shared:</span>
                      <span className="text-slate-300 font-bold">{house.materialsShared}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>🏆 Quizzes Won:</span>
                      <span className="text-slate-300 font-bold">{house.quizzesWon}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>🙋 Class Attendance:</span>
                      <span className="text-emerald-400 font-bold">{house.participation}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* E. SECTION ANALYTICS OVERVIEW */}
        {activeJarvisSection === 'sections' && (
          <div className="space-y-4">
            <span className="text-[10px] text-indigo-400 font-extrabold uppercase font-mono tracking-wider block">📊 Classroom Sections Performance Indicators</span>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {sections.map((sec) => (
                <div 
                  key={sec.id} 
                  className="smart-glass p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-black font-display text-indigo-300 uppercase">Section {sec.id}</span>
                    <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-full font-bold uppercase font-mono">Active</span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Enrollment:</span>
                      <span className="text-white font-bold">{sec.totalStudents} Pupils</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Average Activity:</span>
                      <span className="text-amber-500 font-bold">{sec.studyActivity} Hr/Wk</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Average Quiz Score:</span>
                      <span className="text-emerald-400 font-bold">{sec.quizScores}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Material Contribs:</span>
                      <span className="text-indigo-400 font-bold">{sec.materialContributions} Docs</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHASE 2 SEARCH AND DISCOVERY PANEL */}
        {activeJarvisSection === 'search' && (
          <div className="space-y-6 animate-fadeIn select-text p-1 h-full flex flex-col">
            
            {/* Premium Search Input */}
            <div className="bg-slate-950/40 p-6 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm text-indigo-300 font-black font-display uppercase tracking-widest">Orion Synthesis</span>
                  </div>
                  {searching && (
                    <span className="text-xs text-teal-400 font-bold animate-pulse flex items-center gap-2 font-mono bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Querying Neural Net...
                    </span>
                  )}
                </div>
                
                <div className="flex gap-3 relative group-focus-within:shadow-[0_0_40px_-10px_rgba(79,70,229,0.2)] transition-shadow duration-500 rounded-2xl">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-indigo-500" />
                  </div>
                  <input 
                    type="text"
                    placeholder="Enter any topic to synthesize notes, or search the web..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-slate-900 border-2 border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 focus:bg-slate-950 transition-all font-sans font-medium"
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRunInternetSearch(searchQuery);
                    }}
                  />
                  <button 
                    onClick={() => handleRunInternetSearch(searchQuery)}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-95"
                  >
                    <Globe className="w-4 h-4" /> Search
                  </button>
                  <button 
                    onClick={() => handleRunResourceDiscovery(searchQuery)}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-slate-700 shadow-lg hover:scale-[1.02] active:scale-95"
                  >
                    <BookOpen className="w-4 h-4" /> Discovery
                  </button>
                </div>

                {/* Quick Action Generators */}
                {searchQuery.trim().length > 2 && (
                  <div className="flex flex-col gap-2.5 pt-3">
                    <span className="text-[10px] text-indigo-400 font-extrabold uppercase font-mono tracking-widest block">🪄 Orion Academic Note Synthesis Engines</span>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => handleGenerateSpecializedNotes(searchQuery, 'detailed_notes')}
                        className="px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-indigo-500/20 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Detailed Notes
                      </button>
                      <button 
                        onClick={() => handleGenerateSpecializedNotes(searchQuery, 'chapter_summary')}
                        className="px-3.5 py-2 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 hover:text-pink-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-pink-500/20 shadow-sm"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> Chapter Summary
                      </button>
                      <button 
                        onClick={() => handleGenerateSpecializedNotes(searchQuery, 'exam_prep')}
                        className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-rose-500/20 shadow-sm"
                      >
                        <Award className="w-3.5 h-3.5" /> Exam Prep Notes
                      </button>
                      <button 
                        onClick={() => handleGenerateSpecializedNotes(searchQuery, 'formula_sheet')}
                        className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-amber-500/20 shadow-sm"
                      >
                        <PenTool className="w-3.5 h-3.5" /> Formula Sheet
                      </button>
                      <button 
                        onClick={() => handleGenerateSpecializedNotes(searchQuery, 'revision_notes')}
                        className="px-3.5 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 hover:text-teal-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-teal-500/20 shadow-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Revision Notes
                      </button>
                      <button 
                        onClick={() => handleGenerateLessonPlan(searchQuery)}
                        className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-emerald-500/20 shadow-sm"
                      >
                        <Layers className="w-3.5 h-3.5" /> Generate Study Plan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Results Render */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* AI Grounded Search Content: 8 cols */}
              <div className="md:col-span-8 bg-slate-950/60 p-4 rounded-2xl border border-white/10 space-y-3 flex flex-col min-h-[320px]">
                <span className="text-[10px] text-indigo-400 font-extrabold uppercase font-mono tracking-wider block">📑 AI Research Grounding Summary</span>
                
                <div className="flex-1 overflow-y-auto max-h-[350px] pr-1 scrollbar-thin text-xs text-slate-300 leading-relaxed font-sans">
                  {searchResults ? (
                    renderOrionMarkdown(searchResults)
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-500 space-y-2">
                      <Sparkles className="w-8 h-8 text-slate-600 animate-pulse" />
                      <p className="text-xs max-w-xs font-medium">Orion search engine is idle. Ask Orion or enter a query above to start Phase II real-time academic synthesis.</p>
                    </div>
                  )}
                </div>

                {generatedNotesContent && (
                  <div className="pt-3 border-t border-white/5 flex flex-wrap gap-2 justify-end items-center animate-fadeIn">
                    <button
                      onClick={handleSaveGeneratedNotesToVault}
                      disabled={isNotesSaved}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border shadow-lg ${
                        isNotesSaved 
                          ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 cursor-default' 
                          : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-violet-500/30 hover:scale-[1.02] active:scale-95'
                      }`}
                    >
                      {isNotesSaved ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-emerald-400" /> Saved to Lecture Notes
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" /> Save to Lecture Notes
                        </>
                      )}
                    </button>
                    {isNotesSaved && (
                      <button
                        onClick={() => {
                          setActiveTab('notes');
                          if (onClose) onClose();
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border border-slate-700 hover:scale-[1.02] active:scale-95"
                      >
                        <FileText className="w-4 h-4" /> Open Lecture Notes
                      </button>
                    )}
                  </div>
                )}

                {searchSources && searchSources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                    <span className="text-[10px] text-teal-400 font-extrabold uppercase font-mono tracking-widest block">🔗 Verified Academic Sources & Grounding Links</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {searchSources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative flex items-center gap-3 p-3 rounded-2xl bg-slate-900/95 hover:bg-slate-900 border border-white/5 hover:border-indigo-500/40 transition-all duration-300 text-left hover:scale-[1.02] shadow-md hover:shadow-indigo-500/10"
                        >
                          <div className="h-8 w-8 rounded-xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 group-hover:bg-indigo-600/20 transition-all">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div className="truncate flex-1 space-y-1">
                            <div className="text-xs font-black text-white truncate group-hover:text-indigo-300 transition-colors">{src.title}</div>
                            {src.published_source && (
                              <span className="inline-block text-[8px] font-extrabold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                {src.published_source}
                              </span>
                            )}
                            <div className="text-[9px] text-slate-500 truncate group-hover:text-slate-400 font-mono">{src.uri}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Discovered Materials List: 4 cols */}
              <div className="md:col-span-4 bg-slate-950/60 p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col shadow-xl">
                <span className="text-[10px] text-teal-400 font-extrabold uppercase font-mono tracking-wider block">📂 Material Hub Discoveries</span>
                
                <div className="flex-1 overflow-y-auto max-h-[350px] space-y-3 pr-1">
                  {localMaterials && localMaterials.length > 0 ? (
                    localMaterials.map((mat) => (
                      <a 
                        key={mat.id}
                        href={mat.url || mat.file_url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="group block p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-white/5 hover:border-teal-500/40 hover:shadow-teal-500/5 transition-all duration-300 text-left space-y-2 hover:scale-[1.02]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-teal-500/10 text-teal-400 uppercase tracking-wider border border-teal-500/20">
                            📚 {mat.subject || 'Syllabus'}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono group-hover:text-slate-400">Hub File</span>
                        </div>
                        <div className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors line-clamp-1">{mat.title}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed font-sans">{mat.description || 'No description provided.'}</div>
                      </a>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-550 space-y-2">
                      <div className="h-10 w-10 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <p className="text-[10px] font-mono leading-relaxed max-w-[160px] mx-auto">No local materials found in Hub index.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* F. VOICE LOGS & COMMAND HISTORY */}
        {activeJarvisSection === 'history' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Command audit list */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/10 space-y-3">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase font-mono tracking-wider block">📃 Recents Voice Recognitions</span>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {commandAudit.length > 0 ? (
                  commandAudit.map((aud) => (
                    <div key={aud.id} className="p-2.5 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between text-xs font-mono">
                      <div>
                        <div className="text-slate-300">"{aud.commandText}"</div>
                        <div className="text-[8px] text-slate-500">{new Date(aud.recognizedAt).toLocaleTimeString()}</div>
                      </div>
                      <span className={`text-[8px] uppercase tracking-wider py-0.5 px-2 rounded-full font-bold ${
                        aud.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {aud.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-xs text-center py-6 font-mono">No command audit logs matched.</div>
                )}
              </div>
            </div>

            {/* Response dialogue history */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/10 space-y-3">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase font-mono tracking-wider block">💬 Conversational Dialogues (Chat logs)</span>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {historyItems.length > 0 ? (
                  historyItems.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5 space-y-1.5 text-xs">
                      <div className="font-mono text-slate-450 italic">🗣️ "{item.prompt}"</div>
                      <div className="font-sans text-indigo-350 bg-slate-950/40 p-2 rounded-lg leading-relaxed text-[11px] border border-white/5">{item.response}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-xs text-center py-6 font-mono">No active Jarvis voice history logs found.</div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* 3. INPUT ZONE / SPEECH CONTROLLER */}
      <div className="pt-4 border-t border-white/10 flex items-center gap-3 bg-slate-900/60 backdrop-blur rounded-2xl mt-2 p-2">
        
        {/* Float design mic selector */}
        <div className="relative group flex items-center justify-center">
          <button 
            type="button"
            onClick={toggleListening}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all shadow-md ${
              isListening 
                ? 'bg-red-600 animate-pulse text-white shadow-lg shadow-red-950/50 hover:bg-red-500' 
                : 'bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300'
            }`}
            title={isListening ? "Stop Listening" : "Start Voice Input"}
          >
            <Mic className={`w-5 h-5 ${isListening ? 'scale-110' : ''}`} />
          </button>
          <div className="hidden group-hover:block absolute -top-8 bg-slate-800 text-[10px] text-white px-2 py-1 rounded shadow pointer-events-none whitespace-nowrap z-50">
            {isListening ? "Listening... Click to stop" : "Start Speech-to-text Input"}
          </div>
        </div>

        {/* Text submit form bar */}
        <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
          <input 
            type="text" 
            placeholder="Query Orion... (e.g., 'Open Physics Hub', 'Start whiteboard')"
            value={commandText}
            onChange={e => setCommandText(e.target.value)}
            disabled={isProcessing}
            className="flex-1 bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 transition-all font-mono disabled:opacity-55"
          />

          <button 
            type="submit" 
            disabled={isProcessing || !commandText.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-900 text-white disabled:text-slate-500 rounded-2xl font-black text-xs uppercase cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Execute
          </button>
        </form>

      </div>
    </div>
  );
};
