import { Whiteboard2 } from './components/Whiteboard2';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
  Search, ChevronRight, ChevronDown, Plus, Check, Trash, Trash2, BookOpen, Award, Sparkles, 
  Clock, ArrowRight, Lock, Unlock, Send, Volume2, VolumeX, ZoomIn, 
  ZoomOut, Eye, Settings, MessageSquare, BarChart2, User, Calendar, 
  Flame, Upload, FileText, CheckCircle, Download, ChevronLeft, 
  PenTool, Eraser, Share2, LogOut, AlertTriangle, Activity, RefreshCw,
  Heart, Bookmark, X, Bell, Zap, Gift, Smartphone, Paperclip, History, Brain, Globe,
  LayoutDashboard, Layers, Video, HelpCircle, GraduationCap, Shield, Compass,
  PanelLeftClose, PanelLeftOpen, ClipboardList, CheckSquare, Monitor, Tv, Cpu, Trophy, Swords,
  Key, ArrowLeft, FolderPlus, Pin, Edit2, Move, Folder, Users2, Copy, CheckCheck, Columns, ListOrdered, List, Info
} from 'lucide-react';
import { 
  UserRole, HouseType, SectionType, UserProfile, HouseStats, 
  Task, ScheduleItem, VaultNote, Lesson, FeedbackPost, 
  MaterialResource, QuizQuestion, ChatMessage, ChatRoom, AITeacherPersona,
  Homework, RecentAccount
} from './types';
import { supabase } from './lib/supabase';
import { getVaultNotes, saveVaultNoteToSupabase, deleteVaultNoteFromSupabase, getNoteByCollabCode, updateNoteOrder } from './lib/supabaseNotes';
import { generateFormattedPdf } from './lib/pdfGenerator';
import { getSupabaseUserProfile, saveSupabaseUserProfile, getDefaultProfileForAccount, saveLocalProfileBackup } from './lib/supabaseUsers';
import { getSupabaseHomework, saveSupabaseHomework, deleteSupabaseHomework } from './lib/supabaseHomework';
import { getPersonalTasks, savePersonalTask, updateTaskOrder as saveTaskOrderToSupabase, deletePersonalTask } from './lib/supabaseTasks';
import { getAppNotifications, saveAppNotification, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, generateUUID, registerPushSubscription, getDeviceId, triggerBrowserPushNotification, isUserEligibleForNotification, triggerNotificationSound } from './lib/notifications';
import { requestFCMPermission, setupFCMForegroundListener } from './lib/fcmNotifications';
import { awardStudentXP, isHalloweenBadgeDateRange } from './lib/gamification';
import { getSavedTheme } from './lib/themeSystem';
import {
  streamAIChatClient,
  buildAuthorizedStudentOSContext,
  detectMathInteractiveWidget,
  InteractiveMathWidget,
  saveStudyOutputToFlashcards,
  formatMathematicalText,
  extractTopicTeachingIntent
} from './lib/studentosAiEngine';
import { extractAttachmentContent } from './lib/documentExtractor';
import { AITopicTutorModal } from './components/syllabus/AITopicTutorModal';
import { GamificationRewardToast, DashboardGamificationCard } from './components/StudentGamificationHub';
import { 
  getAiBuddyChats, saveAiBuddyChat, deleteAiBuddyChat, renameAiBuddyChat,
  getPeerMessages, savePeerMessage, deletePeerMessage,
  getChatRooms, saveChatRoom, joinChatRoom, leaveChatRoom, deleteChatRoom,
  clearChatCache
} from './lib/supabaseChat';
import { saveSupabaseMaterial, getSupabaseMaterials, deleteSupabaseMaterial } from './lib/supabaseResources';
import { getFolders, Folder as FolderType, createFolder, renameFolder, deleteFolder } from './lib/supabaseFolders';
import { PdfCanvasViewer } from './components/PdfCanvasViewer';
import { InAppDocumentViewer } from './components/InAppDocumentViewer';
import { PanelBoardSetupDialog } from './components/panel/PanelBoardSetupDialog';
import { ClassroomPanelBoard } from './components/panel/ClassroomPanelBoard';
import { checkPanelRegistration, PanelBoardRegistrationData } from './lib/panelBoardDetector';
import { StudentOSJarvis } from './components/StudentOSJarvis';
import AttendanceManager from './components/AttendanceManager';
import AdminCenter from './components/AdminCenter';
import TeacherStudentList from './components/TeacherStudentList';
import TeacherStudentReports from './components/TeacherStudentReports';
import TeacherProfile from './components/TeacherProfile';
import StudentAttendanceView from './components/StudentAttendanceView';
import StudentAiAnalytics from './components/StudentAiAnalytics';
import HouseChampionship from './components/HouseChampionship';
import SimpleResourceManager from './components/SimpleResourceManager';
import { BlogsPortal } from './components/BlogsPortal';
import { APP_VERSION } from './config/version';
import { AssignmentCenter } from './components/AssignmentCenter';
import StudentMarksCenter from './components/StudentMarksCenter';
import CoordinatorModule from './components/CoordinatorModule';
import { SportsActivitiesPortal } from './components/SportsActivitiesPortal';
import { SubstituteHub } from './components/SubstituteHub';
import { ChatSystem } from './components/ChatSystem';
import { StudentOSMeet } from './components/StudentOSMeet';
import { GlobalSchoolCallModal } from './components/meet/GlobalSchoolCallModal';
import { setupGlobalCallReceiver, acceptSchoolCall, declineSchoolCall } from './lib/callService';
import { NotificationCenter } from './components/NotificationCenter';
import { BroadcastModal } from './components/BroadcastModal';
import { LiveBroadcastBanner } from './components/LiveBroadcastBanner';
import { StudentOSLife } from './components/StudentOSLife';
import { TeacherFunZone } from './components/TeacherFunZone';
import AcademicCalendar from './components/AcademicCalendar';
import DigitalGradebook from './components/DigitalGradebook';
import DigitalReportCards from './components/DigitalReportCards';
import PerformanceAnalytics from './components/PerformanceAnalytics';
import ProfileCustomizer from './components/ProfileCustomizer';
import { ProfileSettings } from './components/ProfileSettings';
import { PromotionalBanners } from './components/PromotionalBanners';
import AIQuotaManagerModal from './components/AIQuotaManagerModal';
import { InstallAppModal, AppInstallSection } from './components/InstallAppModal';
import { isApkInstalledOnDevice } from './config/appConfig';
import { WhatsNewPortal } from './components/WhatsNewPortal';
import { BrandLogo } from './components/brand/BrandLogo';
import { BRAND_CONFIG } from './config/branding';
import { AboutVeylentraPage } from './components/AboutVeylentraPage';
import { SecurityDialog } from './components/SecurityDialog';
import {
  getSecurityStatus,
  lockWorkspace,
  unlockWorkspace,
  setWorkspacePin,
  verifySecurityPin,
  subscribeToWorkspaceLockChanges
} from './lib/securityService';
import { MajorReleaseBanner } from './components/MajorReleaseBanner';
import { StudyCenterFlashcards } from './components/StudyCenterFlashcards';
import { ParentalPortal } from './components/ParentalPortal';
import { BrainBattleArena } from './components/BrainBattleArena';
import { SyllabusStudyPlanner } from './components/SyllabusStudyPlanner';
import { OfficialTimetableViewer } from './components/OfficialTimetableViewer';
import { ReminderService } from './lib/reminderService';
import { ProfessionalTabDropdown } from './components/ProfessionalTabDropdown';
import { getStoredCards } from './lib/flashcardStorage';
import { isCardDue } from './lib/sm2Algorithm';
import { getPublishedUpdates, getUserReadUpdateIds } from './lib/supabaseUpdates';
import { soundService } from './lib/soundService';
import { SoundSettingsModal } from './components/SoundSettingsModal';
import {
  NumberTicker,
  BorderBeam,
  ShimmerButton,
  CardSpotlight,
  BackgroundBeams,
  SplitTextReveal
} from './components/ui/animatedComponents';
import { 
  AIUsageState, 
  getLocalUsageState, 
  recordLocalMessage, 
  fetchAIUsageStatus, 
  BASE_ROLE_LIMITS 
} from './lib/aiUsageManager';
import { MOCK_QUIZZES, AI_PERSONAS, INITIAL_ANNOUNCEMENTS, INITIAL_FEEDBACK, INITIAL_MATERIALS, MOCK_SCHEDULES } from './mockData';
import { FloatingByteWidget } from './components/byte/FloatingByteWidget';
import { StudentOSOnboardingModal } from './components/onboarding/StudentOSOnboardingModal';
import { GuidedProductTour } from './components/onboarding/GuidedProductTour';
import { shouldShowOnboarding } from './lib/onboardingService';
import { BottomSheet } from './components/ui/BottomSheet';
import { Skeleton, SkeletonCard, SkeletonList } from './components/ui/Skeleton';

// Stub Integrations
import {
  handleFirestoreError, OperationType, sendNotificationToUsers,
  auth, db, GoogleAuthProvider, signInWithPopup, signOut,
  doc, collection, query, where, onSnapshot,
  setDoc, updateDoc, deleteDoc
} from './firebase';
import { uploadFileToStorage } from './lib/storageHelper';
import { presenceService } from './lib/presenceService';
import { logTabOpen } from './lib/tabUsageService';

const generateUniqueId = () => {
  return crypto.randomUUID();
};

const CodeBlock = ({ code, language }: { code: string; language: string; key?: any }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-slate-950 font-mono text-xs shadow-md">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className={`px-2 py-1 rounded transition-all text-[9px] font-semibold active:scale-95 ${copied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'}`}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-slate-100 whitespace-pre scrollbar-thin scrollbar-thumb-white/10 select-text leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const parseInlineMarkdown = (line: string) => {
  const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="mx-1 px-1.5 py-0.5 rounded bg-slate-950 border border-white/5 font-mono text-[11px] text-amber-300 font-semibold">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

const renderMarkdown = (rawText: string) => {
  if (!rawText) return null;
  const text = formatMathematicalText(rawText);

  const parts = text.split(/(```[\s\S]*?```|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/g);

  return parts.map((part, index) => {
    if (part.startsWith('```')) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const lang = match ? match[1] : '';
      const code = match ? match[2] : part.slice(3, -3);

      return <CodeBlock key={index} code={code} language={lang} />;
    }

    if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
      const mathFormula = part.replace(/^\$\$|\$\$$|^\\\[|\\\]$/g, '').trim();
      return (
        <div
          key={index}
          className="my-2.5 p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-indigo-200 font-mono text-xs sm:text-sm overflow-x-auto text-center shadow-inner"
        >
          {formatMathematicalText(mathFormula)}
        </div>
      );
    }

    const lines = part.split('\n');
    return (
      <div key={index} className="space-y-1.5">
        {lines.map((line, lIdx) => {
          if (line.trim() === '---' || line.trim() === '***') {
            return <hr key={lIdx} className="my-3 border-t border-white/10" />;
          }

          if (line.startsWith('### ')) {
            return <h4 key={lIdx} className="text-sm font-extrabold text-indigo-300 mt-2 mb-1 tracking-tight">{parseInlineMarkdown(line.substring(4))}</h4>;
          }
          if (line.startsWith('## ')) {
            return <h3 key={lIdx} className="text-base font-black text-indigo-400 mt-3 mb-1.5 tracking-tight">{parseInlineMarkdown(line.substring(3))}</h3>;
          }
          if (line.startsWith('# ')) {
            return <h2 key={lIdx} className="text-lg font-black text-white mt-4 mb-2 tracking-wide">{parseInlineMarkdown(line.substring(2))}</h2>;
          }

          // Render Markdown table rows cleanly
          if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            if (/^\|[\s\-:|]+\|$/.test(line.trim())) return null;
            const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
            return (
              <div key={lIdx} className="grid grid-flow-col auto-cols-fr gap-2 py-1.5 px-2.5 rounded-lg bg-slate-950/60 border border-white/5 text-[11px] overflow-x-auto">
                {cells.map((cell, cIdx) => (
                  <span key={cIdx} className="text-slate-200 font-medium break-words">{parseInlineMarkdown(cell)}</span>
                ))}
              </div>
            );
          }

          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            const raw = line.trim().substring(2);
            return (
              <ul key={lIdx} className="list-disc pl-5 my-0.5 text-slate-300">
                <li className="leading-relaxed">{parseInlineMarkdown(raw)}</li>
              </ul>
            );
          }

          if (/^\d+\.\s/.test(line.trim())) {
            const dotIdx = line.indexOf('.');
            const raw = line.substring(dotIdx + 1).trim();
            const num = line.trim().substring(0, dotIdx);
            return (
              <ol key={lIdx} className="list-decimal pl-5 my-0.5 text-slate-300" start={parseInt(num) || 1}>
                <li className="leading-relaxed">{parseInlineMarkdown(raw)}</li>
              </ol>
            );
          }

          if (line.trim().startsWith('>')) {
            const raw = line.trim().substring(1).trim();
            return (
              <blockquote key={lIdx} className="border-l-4 border-indigo-500/50 bg-indigo-500/5 pl-4 py-1.5 my-1.5 rounded-r-lg italic text-slate-300">
                {parseInlineMarkdown(raw)}
              </blockquote>
            );
          }

          if (!line.trim()) return <div key={lIdx} className="h-1.5" />;
          return <p key={lIdx} className="leading-relaxed mb-1 text-slate-300 text-xs sm:text-sm break-words">{parseInlineMarkdown(line)}</p>;
        })}
      </div>
    );
  });
};

export function getUserProfileTitle(profile: UserProfile | null, effectiveRole?: string): string {
  if (!profile) return 'Guest';
  const role = effectiveRole || profile.role;

  if (role === 'student') {
    const gradeNum = profile.grade ? profile.grade.replace('Grade ', '') : '';
    const section = profile.section || '';
    if (gradeNum && section) {
      return `Class ${gradeNum} ${section} Student`;
    } else if (gradeNum) {
      return `Class ${gradeNum} Student`;
    } else if (section) {
      return `${section} Student`;
    }
    return 'Student';
  }

  if (role === 'teacher') {
    if (profile.specialtySubject) {
      return `${profile.specialtySubject} Teacher`;
    }
    return 'Teacher';
  }

  if (role === 'coordinator') {
    if (profile.designation) {
      return profile.designation;
    }
    return 'Academic Coordinator';
  }

  if (role === 'admin') {
    return 'School Administrator';
  }

  if (role === 'super_admin') {
    return 'Super Administrator';
  }

  if (role) {
    const capitalized = (role as string).charAt(0).toUpperCase() + (role as string).slice(1).replace('_', ' ');
    return capitalized;
  }
  return 'Member';
}

export default function App() {

  useEffect(() => {
    if (window.opener && window.location.hash.includes('access_token=')) {
      window.opener.postMessage({
        type: 'SUPABASE_AUTH_SUCCESS',
        hash: window.location.hash
      }, window.location.origin);
      setTimeout(() => window.close(), 500);
    }
  }, []);

  useEffect(() => {
    const handleSwitchTab = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('switch-tab', handleSwitchTab as EventListener);
    return () => window.removeEventListener('switch-tab', handleSwitchTab as EventListener);
  }, []);

  // Global States
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('s_os_user');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const currentUserRef = useRef<UserProfile | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  const [firebaseLoading, setFirebaseLoading] = useState<boolean>(true);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [firebaseOnboardingUser, setFirebaseOnboardingUser] = useState<any>(null);
  const [authError, setAuthError] = useState<{ code: string; message: string; hostname: string } | null>(null);

  // Request notification permission & sync FCM tokens to Firestore & backend on app start
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const uid = currentUser?.uid || 'usr_anonymous';
      const meta = {
        role: currentUser?.role || 'student',
        grade: currentUser?.grade || '',
        section: currentUser?.section || '',
        house: currentUser?.house || ''
      };
      requestFCMPermission(uid, meta);
      if (Notification.permission === 'granted' && currentUser?.uid) {
        registerPushSubscription(currentUser.uid, meta);
      }
    }
  }, [currentUser?.uid, currentUser?.role, currentUser?.grade, currentUser?.section, currentUser?.house]);

  // Setup FCM Foreground message listener
  useEffect(() => {
    let cleanupListener: (() => void) | null = null;
    setupFCMForegroundListener((payload) => {
      if (payload.data?.linkTab) {
        // Optionally update in-app notifications
      }
    }).then(unsub => {
      cleanupListener = unsub;
    });

    return () => {
      if (cleanupListener) cleanupListener();
    };
  }, []);

  // Listen for navigation messages from Service Worker (e.g. when clicking a browser push notification)
  useEffect(() => {
    const handleNavigateEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.linkTab) {
        setActiveTab(customEvent.detail.linkTab);
      }
    };
    window.addEventListener('studentos-navigate-tab', handleNavigateEvent);
    return () => {
      window.removeEventListener('studentos-navigate-tab', handleNavigateEvent);
    };
  }, []);

  // Setup Global School Call Receiver
  useEffect(() => {
    if (!currentUser?.uid) return;
    const cleanup = setupGlobalCallReceiver(currentUser);
    return () => {
      cleanup();
    };
  }, [currentUser?.uid]);

  // Handle call actions from service worker or URL parameters (e.g. Push notification Accept/Decline clicks)
  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        type === 'INCOMING_CALL_ACTION' ||
        type === 'STUDENTOS_CALL_ACTION' ||
        type === 'STUDENTOS_INCOMING_CALL' ||
        type === 'FCM_SW_INCOMING_CALL'
      ) {
        const action = event.data?.action;
        const callId = event.data?.callId;
        if (action === 'accept') {
          acceptSchoolCall(callId, currentUser);
        } else if (action === 'decline') {
          declineSchoolCall(callId, 'declined_via_sw', currentUser);
        }
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const callAction = urlParams.get('callAction');
      const autoAccept = urlParams.get('autoAccept');
      const callId = urlParams.get('callId') || undefined;
      if (callAction === 'accept' || autoAccept === '1') {
        acceptSchoolCall(callId, currentUser);
      } else if (callAction === 'decline') {
        declineSchoolCall(callId, 'declined_via_url', currentUser);
      }
      if (urlParams.has('callAction') || urlParams.has('callId') || urlParams.has('autoAccept')) {
        urlParams.delete('callAction');
        urlParams.delete('callId');
        urlParams.delete('autoAccept');
        const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
        window.history.replaceState(null, '', newUrl);
      }
    } catch (_) {}

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, [currentUser]);

  const DEV_MODE = false; // Production release
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const effectiveRole = (isSuperAdmin || DEV_MODE) && simulatedRole ? simulatedRole : currentUser?.role;
  const isSportsTeacher = !!(currentUser && effectiveRole === 'teacher' && (
    (currentUser.department || '').toLowerCase().includes('sport') ||
    (currentUser.department || '').toLowerCase().includes('activity') ||
    (currentUser.department || '').toLowerCase().includes('pe') ||
    (currentUser.department || '').toLowerCase().includes('physical') ||
    (currentUser.department || '').toLowerCase().includes('co-curricular') ||
    (currentUser.department || '').toLowerCase().includes('karate') ||
    (currentUser.department || '').toLowerCase().includes('taekwondo') ||
    (currentUser.department || '').toLowerCase().includes('dance') ||
    (currentUser.department || '').toLowerCase().includes('music') ||
    (currentUser.department || '').toLowerCase().includes('art') ||
    (currentUser.specialtySubject || '').toLowerCase().includes('art') ||
    (currentUser.specialtySubject || '').toLowerCase().includes('music') ||
    (currentUser.specialtySubject || '').toLowerCase().includes('dance') ||
    (currentUser.specialtySubject || '').toLowerCase().includes('karate')
  ));



  const [isInstallAppModalOpen, setIsInstallAppModalOpen] = useState<boolean>(false);
  const [isSoundSettingsModalOpen, setIsSoundSettingsModalOpen] = useState<boolean>(false);
  const [isApkInstalled, setIsApkInstalled] = useState<boolean>(() => isApkInstalledOnDevice());
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);
  const [isProductTourOpen, setIsProductTourOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleInstallChanged = (e: any) => {
      setIsApkInstalled(Boolean(e.detail?.installed));
    };
    window.addEventListener('studentos_apk_installed_changed', handleInstallChanged);
    return () => window.removeEventListener('studentos_apk_installed_changed', handleInstallChanged);
  }, []);

  // Check if onboarding should appear for new users or upon explicit restart request
  useEffect(() => {
    if (currentUser && !dataLoading && !firebaseLoading) {
      if (shouldShowOnboarding(currentUser)) {
        setIsOnboardingModalOpen(true);
      }
    }
  }, [currentUser, dataLoading, firebaseLoading]);

  // Global listeners for manual Onboarding / Product Tour launches
  useEffect(() => {
    const handleLaunchOnboarding = () => setIsOnboardingModalOpen(true);
    const handleLaunchTour = () => setIsProductTourOpen(true);
    window.addEventListener('studentos_launch_onboarding', handleLaunchOnboarding);
    window.addEventListener('studentos_launch_tour', handleLaunchTour);
    return () => {
      window.removeEventListener('studentos_launch_onboarding', handleLaunchOnboarding);
      window.removeEventListener('studentos_launch_tour', handleLaunchTour);
    };
  }, []);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname.toLowerCase();
        if (path === '/whats-new' || path === '/whats_new' || path === '/updates') {
          return 'whats_new';
        }
        if (path === '/study-hub' || path === '/study_hub' || path === '/flashcards' || path === '/study-center' || path === '/study_center' || path === '/tasks' || path === '/planner') {
          return 'study_hub';
        }
      }
      return localStorage.getItem('s_os_active_tab') || 'dashboard';
    } catch (e) {
      console.warn('[Storage] Unsafe activeTab localStorage read:', e);
      return 'dashboard';
    }
  });

  const [whatsNewUnreadCount, setWhatsNewUnreadCount] = useState<number>(0);
  const [dueCardsCount, setDueCardsCount] = useState<number>(0);
  const [studyHubSubTab, setStudyHubSubTab] = useState<'tasks' | 'planner' | 'flashcards'>('flashcards');

  useEffect(() => {
    if (activeTab === 'tasks') setStudyHubSubTab('tasks');
    else if (activeTab === 'planner') setStudyHubSubTab('planner');
    else if (activeTab === 'flashcards') setStudyHubSubTab('flashcards');

    try {
      localStorage.setItem('s_os_active_tab', activeTab);
      presenceService.updateCurrentTab(activeTab);
      if (currentUser) {
        logTabOpen(activeTab, currentUser);
      }
    } catch (_) {}
  }, [activeTab, currentUser]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path === '/whats-new' || path === '/whats_new' || path === '/updates') {
        setActiveTab('whats_new');
      } else if (path === '/tasks') {
        setActiveTab('study_hub');
        setStudyHubSubTab('tasks');
      } else if (path === '/planner') {
        setActiveTab('study_hub');
        setStudyHubSubTab('planner');
      } else if (path === '/flashcards' || path === '/study-center' || path === '/study_center' || path === '/study-hub' || path === '/study_hub') {
        setActiveTab('study_hub');
        setStudyHubSubTab('flashcards');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Track Due Flashcards count for Spaced Repetition badge
  useEffect(() => {
    const updateDueCards = () => {
      try {
        const allCards = getStoredCards();
        const count = allCards.filter(c => isCardDue(c)).length;
        setDueCardsCount(count);
      } catch (e) {}
    };
    updateDueCards();
    const interval = setInterval(updateDueCards, 30000);
    window.addEventListener('storage', updateDueCards);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', updateDueCards);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const calculateWhatsNewUnread = async () => {
      try {
        const uRole = (effectiveRole as any) || currentUser?.role || 'student';
        const uId = currentUser?.uid || currentUser?.email || 'guest';
        const [allPublished, readSet] = await Promise.all([
          getPublishedUpdates(uRole),
          getUserReadUpdateIds(uId)
        ]);
        if (active) {
          const unread = allPublished.filter(u => !readSet.has(u.id)).length;
          setWhatsNewUnreadCount(unread);
        }
      } catch (_) {}
    };

    calculateWhatsNewUnread();
    const interval = setInterval(calculateWhatsNewUnread, 30000);
    const handleUpdate = () => calculateWhatsNewUnread();
    window.addEventListener('studentos_whats_new_updated', handleUpdate);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('studentos_whats_new_updated', handleUpdate);
    };
  }, [currentUser?.uid, effectiveRole]);

  // Halloween 2026 Visitor Badge Logic (Target: Oct 29 – Nov 1)
  useEffect(() => {
    if (currentUser && currentUser.uid && !dataLoading && !firebaseLoading) {
      if (isHalloweenBadgeDateRange()) {
        const currentBadges = currentUser.badges || [];
        if (!currentBadges.includes('halloween_2026') && !currentBadges.includes('Halloween 2026')) {
          const updatedUser = {
            ...currentUser,
            badges: [...currentBadges, 'halloween_2026']
          };
          setCurrentUser(updatedUser);
          saveSupabaseUserProfile(updatedUser).catch(() => {});
          showNotification('🎃 Halloween 2026 Badge Awarded!');
        }
      }
    }
  }, [currentUser?.uid, dataLoading, firebaseLoading]);
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState<string>('');
  const [collapsedSidebarSections, setCollapsedSidebarSections] = useState<Record<string, boolean>>({});
  const toggleSidebarSection = (sectionKey: string) => {
    setCollapsedSidebarSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };
  const [clock, setClock] = useState<string>('');
  
  // Homework filter states
  const [hwFilterGrade, setHwFilterGrade] = useState<string>('All Grades');
  const [hwSearch, setHwSearch] = useState<string>('');
  
  // Homework Edit states
  const [hwFormOpen, setHwFormOpen] = useState(false);
  const [hwEditId, setHwEditId] = useState<string | null>(null);
  const [hwFSubject, setHwFSubject] = useState('');
  const [hwFTitle, setHwFTitle] = useState('');
  const [hwFContent, setHwFContent] = useState('');
  const [hwFGrade, setHwFGrade] = useState('Grade 12');
  const [hwFSection, setHwFSection] = useState<SectionType | 'All Sections'>('All Sections');
  
  const [profileTab, setProfileTab] = useState<string>('overview');

  // Notification States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifCenter, setShowNotifCenter] = useState<boolean>(false);

  // Secure Role Registration Selection State
  const [requestedAccountType, setRequestedAccountType] = useState<'student' | 'teacher' | 'coordinator' | 'admin'>('student');

  // Redesigned Sign Up Flow States
  const [regStep, setRegStep] = useState<'login' | 'role' | 'profile' | 'submit' | 'reset-password'>('role');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const regStepRef = useRef(regStep);
  useEffect(() => {
    regStepRef.current = regStep;
  }, [regStep]);

  const [regRole, setRegRole] = useState<'student' | 'teacher' | 'coordinator' | 'admin'>('student');
  const [regName, setRegName] = useState('');
  const [regNameError, setRegNameError] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPhoneError, setRegPhoneError] = useState('');
  const [regBirthdate, setRegBirthdate] = useState('');
  const [regBirthdateError, setRegBirthdateError] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regGrade, setRegGrade] = useState('Grade 10');
  const [regSection, setRegSection] = useState('Solara');
  const [regHouse, setRegHouse] = useState('Emerald');
  const [regPhoto, setRegPhoto] = useState('');
  const [regDept, setRegDept] = useState('');
  const [regSubjects, setRegSubjects] = useState('');
  const [regDesignation, setRegDesignation] = useState('');
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [linkedGoogleUid, setLinkedGoogleUid] = useState<string | null>(null);
  const [linkedGooglePhoto, setLinkedGooglePhoto] = useState<string | null>(null);

  // Startup Screen States
  const [showStartup, setShowStartup] = useState<boolean>(() => {
    try {
      const shown = sessionStorage.getItem('s_os_startup_shown');
      return shown !== 'true';
    } catch (_) {
      return true;
    }
  });
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingStep, setLoadingStep] = useState<number>(0);

  // Classroom Security & Smart Board Mode States
  const [presentationMode, setPresentationMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('s_os_presentation_mode') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [smartBoardMode, setSmartBoardMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('s_os_smart_board_mode') === 'true';
    } catch (e) {
      return false;
    }
  });
  // Classroom Security & Workspace Lock States
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isSecurityChecking, setIsSecurityChecking] = useState<boolean>(true);
  const [hasPinConfigured, setHasPinConfigured] = useState<boolean>(false);
  const [securityStatusError, setSecurityStatusError] = useState<string>('');
  const [isLockingWorkspace, setIsLockingWorkspace] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [isSavingPin, setIsSavingPin] = useState<boolean>(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [currentPinInput, setCurrentPinInput] = useState<string>('');

  const [autoLockTime, setAutoLockTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('s_os_auto_lock_time');
      return saved ? parseInt(saved, 10) : 0; // default 0 (Off)
    } catch (e) {
      return 0;
    }
  });
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [securityMenuOpen, setSecurityMenuOpen] = useState<boolean>(false);

  // Pin creation & validation modal states
  const [pinSetupOpen, setPinSetupOpen] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const [pinVerifyOpen, setPinVerifyOpen] = useState<boolean>(false);
  const [verifyPinInput, setVerifyPinInput] = useState<string>('');
  const [pinVerifyAction, setPinVerifyAction] = useState<(() => void) | null>(null);

  const [lockScreenPinInput, setLockScreenPinInput] = useState<string>('');
  const [lockScreenError, setLockScreenError] = useState<string>('');
  const [useKeyMode, setUseKeyMode] = useState<boolean>(false);

  // Panel Board State
  const [isPanelBoardOpen, setIsPanelBoardOpen] = useState<boolean>(false);
  const [showPanelSetupDialog, setShowPanelSetupDialog] = useState<boolean>(false);
  const [panelBoardRegistration, setPanelBoardRegistration] = useState<PanelBoardRegistrationData | null>(null);

  // In-App Learning Workspace Document Viewer State
  const [inAppViewerDoc, setInAppViewerDoc] = useState<{ url: string; title?: string; fileName?: string; fileType?: string } | null>(null);

  const handleOpenPanelBoard = async () => {
    try {
      const reg = await checkPanelRegistration();
      if (reg && reg.status === 'active') {
        setPanelBoardRegistration(reg);
        setIsPanelBoardOpen(true);
      } else {
        setShowPanelSetupDialog(true);
      }
    } catch (_) {
      setShowPanelSetupDialog(true);
    }
  };

  const isTabAllowedInPresentation = (tab: string) => {
    return ['whiteboard', 'ai_teacher', 'materials', 'assignments', 'homework', 'pomodoro', 'planner', 'tasks', 'flashcards', 'study_hub'].includes(tab);
  };

  const getSidebarBtnClass = (tab: string, type: 'standard' | 'faculty' | 'attendance' | 'admin' = 'standard') => {
    const isActive =
      tab === 'study_hub'
        ? ['study_hub', 'tasks', 'planner', 'flashcards'].includes(activeTab)
        : tab === 'brain_battle' || tab === 'quiz'
        ? ['brain_battle', 'quiz'].includes(activeTab)
        : activeTab === tab;
    let base = `group relative w-full flex items-center transition-all duration-200 rounded-xl border text-left min-w-0 cursor-pointer active:scale-95 ${
      sidebarOpen ? 'gap-3 px-3 py-2.5' : 'md:justify-center md:px-0 md:py-2.5 gap-3 px-3 py-2.5'
    } `;
    if (smartBoardMode) {
      base += `text-xs sm:text-sm font-extrabold `;
    } else {
      base += `text-xs font-semibold `;
    }

    if (isActive) {
      if (type === 'faculty') base += 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 border-emerald-500';
      else if (type === 'attendance') base += 'bg-amber-600 text-white shadow-md shadow-amber-600/20 border-amber-500';
      else if (type === 'admin') base += 'bg-rose-600 text-white shadow-md shadow-rose-600/20 border-rose-500';
      else base += 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-500';
    } else {
      if (type === 'faculty') base += 'text-emerald-400 hover:text-white hover:bg-emerald-500/10 border-emerald-500/20';
      else if (type === 'attendance') base += 'text-amber-400 hover:text-white hover:bg-amber-500/10 border-amber-500/20';
      else if (type === 'admin') base += 'text-rose-400 hover:text-white hover:bg-rose-500/10 border-rose-500/20';
      else base += 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border-transparent hover:border-white/10';
    }
    return base;
  };

  const handleSavePin = async () => {
    if (newPin.length !== 4 && newPin.length !== 6) {
      setPinError('PIN must be exactly 4 or 6 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match.');
      return;
    }
    if (hasPinConfigured && !currentPinInput) {
      setPinError('Current PIN is required to change PIN.');
      return;
    }

    setIsSavingPin(true);
    setPinError('');
    try {
      const res = await setWorkspacePin(newPin, hasPinConfigured ? currentPinInput : undefined, currentUser?.uid);
      if (res.success) {
        setHasPinConfigured(true);
        setPinSetupOpen(false);
        setNewPin('');
        setConfirmPin('');
        setCurrentPinInput('');
        setPinError('');
        try { localStorage.removeItem('s_os_teacher_pin'); } catch(e){}
        showNotification('✅ Security PIN saved and enforced on server!');
      } else {
        setPinError(res.error || 'Failed to save security PIN.');
      }
    } catch (e) {
      setPinError('Network error while saving PIN.');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!verifyPinInput) {
      setPinError('Please enter your security PIN.');
      return;
    }
    setIsVerifyingPin(true);
    setPinError('');
    try {
      const res = await verifySecurityPin(verifyPinInput);
      if (res.success) {
        if (pinVerifyAction) {
          pinVerifyAction();
        }
        setPinVerifyOpen(false);
        setPinVerifyAction(null);
        setVerifyPinInput('');
        setPinError('');
      } else {
        setPinError(res.error || 'Incorrect security PIN.');
      }
    } catch (e) {
      setPinError('Connection error during verification.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const triggerPinVerification = (action: () => void) => {
    if (!hasPinConfigured) {
      setPinSetupOpen(true);
      return;
    }
    setPinVerifyAction(() => action);
    setPinVerifyOpen(true);
  };

  const handleUnlockWithPin = async () => {
    if (!lockScreenPinInput) {
      setLockScreenError('Please enter your security PIN.');
      return;
    }
    setIsUnlocking(true);
    setLockScreenError('');
    try {
      const res = await unlockWorkspace(lockScreenPinInput);
      if (res.success) {
        setIsLocked(false);
        setLockScreenPinInput('');
        setLockScreenError('');
        setLastActivity(Date.now());
        showNotification('🔓 Workspace unlocked successfully.');
      } else {
        setLockScreenError(res.error || 'Incorrect security PIN.');
        setLockScreenPinInput('');
      }
    } catch (err) {
      setLockScreenError('Connection error during unlock verification.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLockWorkspace = async () => {
    if (!hasPinConfigured) {
      setSecurityMenuOpen(false);
      setPinSetupOpen(true);
      showNotification('🔑 Please configure a Security PIN before locking.');
      return;
    }
    setIsLockingWorkspace(true);
    try {
      const res = await lockWorkspace({
        userId: currentUser?.uid,
        userName: currentUser?.name || 'Faculty Member'
      });
      if (res.success) {
        setIsLocked(true);
        setSecurityMenuOpen(false);
        showNotification('🔒 Workspace locked. PIN required to resume.');
      } else {
        showNotification('⚠️ ' + (res.error || 'Failed to lock workspace.'));
      }
    } catch (err) {
      showNotification('⚠️ Network error while locking workspace.');
    } finally {
      setIsLockingWorkspace(false);
    }
  };

  const handleTabSelect = (tab: string) => {
    soundService.playButtonClick();
    if (presentationMode && !isTabAllowedInPresentation(tab)) {
      showNotification('🔒 This tab is hidden in Presentation Mode for classroom safety.');
      return;
    }
    setActiveTab(tab);
    localStorage.setItem('s_os_active_tab', tab);
    if (tab === 'whats_new') {
      window.history.pushState(null, '', '/whats-new');
    } else if (typeof window !== 'undefined' && (window.location.pathname === '/whats-new' || window.location.pathname === '/whats_new')) {
      window.history.pushState(null, '', '/');
    }
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };
  
  // Theme & Accessibility States
  const [lightMode, setLightMode] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<'standard' | 'large' | 'huge'>('standard');
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('s_os_tts_enabled') === 'true';
    } catch (e) {
      console.warn('[Storage] Unsafe ttsEnabled localStorage read:', e);
      return false;
    }
  });

  // Business Data States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [vaultNotes, setVaultNotes] = useState<VaultNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteEditMode, setNoteEditMode] = useState<boolean>(true);
  const [noteFont, setNoteFont] = useState<'sans' | 'serif' | 'mono'>('sans');

  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);

  const [vaultFolders, setVaultFolders] = useState<FolderType[]>([]);
  const [activeVaultFolderId, setActiveVaultFolderId] = useState<string | null>(null);
  const [vaultItemHoldMenu, setVaultItemHoldMenu] = useState<{ noteId: string, x: number, y: number } | null>(null);
  const [showVaultFolderModal, setShowVaultFolderModal] = useState<boolean>(false);
  const [newVaultFolderName, setNewVaultFolderName] = useState<string>('');
  const [renameVaultFolderModal, setRenameVaultFolderModal] = useState<{ id: string; name: string } | null>(null);
  const [renameVaultInput, setRenameVaultInput] = useState<string>('');

  // Material Hub Folder Management States
  const [materialFolders, setMaterialFolders] = useState<FolderType[]>([]);
  const [activeMaterialFolderId, setActiveMaterialFolderId] = useState<string | null>(null);
  const [showMaterialFolderModal, setShowMaterialFolderModal] = useState<boolean>(false);
  const [newMaterialFolderName, setNewMaterialFolderName] = useState<string>('');
  const [renameMaterialFolderModal, setRenameMaterialFolderModal] = useState<{ id: string; name: string } | null>(null);
  const [renameMaterialInput, setRenameMaterialInput] = useState<string>('');
  const [materialItemHoldMenu, setMaterialItemHoldMenu] = useState<{ materialId: string; x: number; y: number } | null>(null);

  // Lecture Notes Notion-style UX States
  const [collabJoinModalOpen, setCollabJoinModalOpen] = useState<boolean>(false);
  const [collabJoinCodeInput, setCollabJoinCodeInput] = useState<string>('');
  const [collabJoinError, setCollabJoinError] = useState<string>('');
  const [collabJoinLoading, setCollabJoinLoading] = useState<boolean>(false);
  const [activeNoteCollabModalOpen, setActiveNoteCollabModalOpen] = useState<boolean>(false);
  const [showNoteOutline, setShowNoteOutline] = useState<boolean>(true);
  const [slashMenuOpen, setSlashMenuOpen] = useState<boolean>(false);
  const [slashMenuFilter, setSlashMenuFilter] = useState<string>('');
  const [autoSaveState, setAutoSaveState] = useState<'saved' | 'saving'>('saved');
  const [viewSplitPreview, setViewSplitPreview] = useState<boolean>(false);

  const handlePinVaultNote = async (noteId: string) => {
    const note = vaultNotes.find(n => n.id === noteId);
    if (!note) return;
    const updated = vaultNotes.map(n => n.id === noteId ? { ...n, isPinned: !(n as any).isPinned } : n);
    setVaultNotes(updated);
    await saveVaultNoteToSupabase({ ...note, isPinned: !(note as any).isPinned } as any);
    setVaultItemHoldMenu(null);
  };

  const handleRenameVaultNote = async (noteId: string) => {
    const note = vaultNotes.find(n => n.id === noteId);
    if (!note) return;
    const newTitle = window.prompt('Enter new title for note:', note.title);
    if (newTitle && newTitle.trim()) {
      const updated = { ...note, title: newTitle.trim() };
      setVaultNotes(prev => prev.map(n => n.id === noteId ? updated : n));
      await saveVaultNoteToSupabase(updated);
      showNotification('Note title updated.');
    }
    setVaultItemHoldMenu(null);
  };

  const handleShareVaultNote = (noteId: string) => {
    const note = vaultNotes.find(n => n.id === noteId);
    if (!note) return;
    const collabCode = (note as any).collabCode || Math.floor(100000 + Math.random() * 900000).toString();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(collabCode);
      showNotification(`Copied 6-digit Collab Code (${collabCode}) to clipboard!`);
    } else {
      showNotification(`Collab Code: ${collabCode}`);
    }
    setVaultItemHoldMenu(null);
  };

  const handleRenameVaultFolder = async () => {
    if (!renameVaultFolderModal || !renameVaultInput.trim()) return;
    try {
      await renameFolder(renameVaultFolderModal.id, renameVaultInput.trim());
      setVaultFolders(prev => prev.map(f => f.id === renameVaultFolderModal.id ? { ...f, name: renameVaultInput.trim() } : f));
      showNotification('✓ Folder renamed');
      setRenameVaultFolderModal(null);
      setRenameVaultInput('');
    } catch (err: any) {
      showNotification(`⚠️ Failed to rename folder: ${err.message || 'Error'}`);
    }
  };

  const handleDeleteVaultFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Delete folder "${folderName}"? Notes inside will be moved to Root.`)) return;
    try {
      await deleteFolder(folderId);
      setVaultFolders(prev => prev.filter(f => f.id !== folderId));
      if (activeVaultFolderId === folderId) setActiveVaultFolderId(null);
      setVaultNotes(prev => prev.map(n => n.folder_id === folderId ? { ...n, folder_id: null } : n));
      showNotification('🗑️ Folder deleted');
    } catch (err: any) {
      showNotification(`⚠️ Failed to delete folder: ${err.message || 'Error'}`);
    }
  };

  const handleMoveVaultNoteToFolder = async (noteId: string, folderId: string | null) => {
    if (folderId) {
      const targetFolder = vaultFolders.find(f => f.id === folderId);
      if (targetFolder && targetFolder.type !== 'notes') {
        showNotification('⚠️ Personal notes can only be moved into Personal Notes folders.');
        setVaultItemHoldMenu(null);
        return;
      }
    }
    const note = vaultNotes.find(n => n.id === noteId);
    if (!note) return;
    const updated = vaultNotes.map(n => n.id === noteId ? { ...n, folder_id: folderId } : n);
    setVaultNotes(updated);
    await saveVaultNoteToSupabase({ ...note, folder_id: folderId });
    showNotification(folderId ? '📁 Moved note to folder' : '📂 Moved note to root');
    setVaultItemHoldMenu(null);
  };

  const handleDeleteVaultNote = async (noteId: string) => {
    if (!currentUser?.uid) return;
    setVaultNotes(prev => prev.filter(n => n.id !== noteId));
    await deleteVaultNoteFromSupabase(noteId, currentUser.uid);
    showNotification('Lecture note deleted from Supabase.');
    setVaultItemHoldMenu(null);
    if (selectedNoteId === noteId) setSelectedNoteId(null);
  };

  // Material Hub Folder Handlers
  const handleCreateMaterialFolder = async () => {
    if (!newMaterialFolderName.trim() || !currentUser?.uid) return;
    try {
      const saved = await createFolder(newMaterialFolderName.trim(), 'materials', currentUser.uid);
      setMaterialFolders(prev => [saved, ...prev]);
      showNotification(`✓ Created Material folder "${saved.name}"`);
      setNewMaterialFolderName('');
      setShowMaterialFolderModal(false);
    } catch (err: any) {
      showNotification(`⚠️ Failed to create folder: ${err.message || 'Error'}`);
    }
  };

  const handleRenameMaterialFolder = async () => {
    if (!renameMaterialFolderModal || !renameMaterialInput.trim()) return;
    try {
      await renameFolder(renameMaterialFolderModal.id, renameMaterialInput.trim());
      setMaterialFolders(prev => prev.map(f => f.id === renameMaterialFolderModal.id ? { ...f, name: renameMaterialInput.trim() } : f));
      showNotification('✓ Folder renamed');
      setRenameMaterialFolderModal(null);
      setRenameMaterialInput('');
    } catch (err: any) {
      showNotification(`⚠️ Failed to rename folder: ${err.message || 'Error'}`);
    }
  };

  const handleDeleteMaterialFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Delete folder "${folderName}"? Files inside will be moved to Root.`)) return;
    try {
      await deleteFolder(folderId);
      setMaterialFolders(prev => prev.filter(f => f.id !== folderId));
      if (activeMaterialFolderId === folderId) setActiveMaterialFolderId(null);
      setMaterials(prev => prev.map(m => m.folder_id === folderId ? { ...m, folder_id: null } : m));
      showNotification('🗑️ Folder deleted');
    } catch (err: any) {
      showNotification(`⚠️ Failed to delete folder: ${err.message || 'Error'}`);
    }
  };

  const handleMoveMaterialToFolder = async (materialId: string, folderId: string | null) => {
    if (folderId) {
      const targetFolder = materialFolders.find(f => f.id === folderId);
      if (!targetFolder || targetFolder.type !== 'materials') {
        showNotification('⚠️ Materials can only be moved into Material Hub folders.');
        setMaterialItemHoldMenu(null);
        return;
      }
    }
    const mat = materials.find(m => m.id === materialId);
    if (!mat) return;
    const updated = { ...mat, folder_id: folderId };
    setMaterials(prev => prev.map(m => m.id === materialId ? updated : m));
    await saveSupabaseMaterial(updated);
    showNotification(folderId ? '📁 Moved resource to folder' : '📂 Moved resource to root');
    setMaterialItemHoldMenu(null);
  };

  // Lecture Notes 6-Digit Collab Handlers
  const handleOpenNoteCollab = async (note: VaultNote) => {
    let collabCode = note.collabCode;
    if (!collabCode) {
      collabCode = Math.floor(100000 + Math.random() * 900000).toString();
      const updated = { ...note, collabCode, isCollab: true };
      setVaultNotes(prev => prev.map(n => n.id === note.id ? updated : n));
      await saveVaultNoteToSupabase(updated);
    }
    setActiveNoteCollabModalOpen(true);
  };

  const handleJoinNoteByCode = async (code: string) => {
    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setCollabJoinError('Please enter a valid 6-digit collaboration code.');
      return;
    }
    setCollabJoinLoading(true);
    setCollabJoinError('');
    try {
      const found = await getNoteByCollabCode(cleanCode);
      if (found) {
        // Add to user's notes if not already present
        setVaultNotes(prev => {
          const exists = prev.find(n => n.id === found.id || n.collabCode === cleanCode);
          if (exists) return prev;
          return [found, ...prev];
        });
        setSelectedNoteId(found.id);
        setNoteEditMode(true);
        showNotification(`🤝 Successfully joined note: "${found.title}"`);
        setCollabJoinModalOpen(false);
        setCollabJoinCodeInput('');
      } else {
        setCollabJoinError(`No note found matching code "${cleanCode}". Confirm the code with the note author.`);
      }
    } catch (err: any) {
      setCollabJoinError(err.message || 'Failed to join note.');
    } finally {
      setCollabJoinLoading(false);
    }
  };
  
  // --- Core State Expansion for Multi-User Real-time Sync & Custom Tools ---
  const socketRef = useRef<any>(null);
  const lastXRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const holdTimerRef = useRef<any>(null);
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const whiteboardHistory = useRef<string[]>([]);
  const whiteboardRedoStack = useRef<string[]>([]);
  const aiChatsSyncingFor = useRef<string | null>(null);

  const [announcements, setAnnouncements] = useState<any[]>([]);

  // AI Notes Generator Parameters
  const [aiGeneratingNotes, setAiGeneratingNotes] = useState<boolean>(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState<string>('');

  // Whiteboard Configurations & Classroom panel projection modes
  const [isSmartBoardPanelMode, setIsSmartBoardPanelMode] = useState<boolean>(false);
  const [isJarvisActive, setIsJarvisActive] = useState<boolean>(false);
  const [canvasShape, setCanvasShape] = useState<'free' | 'rect' | 'circle'>('free');

  // Materials Audience alignment toggles
  const [newMaterialIsPublic, setNewMaterialIsPublic] = useState<boolean>(true);
  const [newMaterialVisibility, setNewMaterialVisibility] = useState<'student' | 'teacher' | 'private'>('student');
  const [newMaterialGrades, setNewMaterialGrades] = useState<string[]>([]);
  const [newMaterialSections, setNewMaterialSections] = useState<string[]>([]);
  const [newMaterialHouses, setNewMaterialHouses] = useState<string[]>([]);
  const [materialsSearchQuery, setMaterialsSearchQuery] = useState<string>('');
  const [materialsSubjectFilter, setMaterialsSubjectFilter] = useState<string>('All');

  // Extended Material Hub parameters
  const [selectedMaterialForAi, setSelectedMaterialForAi] = useState<MaterialResource | null>(null);
  const [aiActionLoading, setAiActionLoading] = useState<boolean>(false);
  const [aiActionResultText, setAiActionResultText] = useState<string>('');
  const [aiActionType, setAiActionType] = useState<string>('');
  const [aiUserQuestion, setAiUserQuestion] = useState<string>('');
  const [activeMaterialSubTab, setActiveMaterialSubTab] = useState<string>('feed');
  const [materialsGradeFilter, setMaterialsGradeFilter] = useState<string>('All');
  const [materialsTypeFilter, setMaterialsTypeFilter] = useState<string>('All');
  const [materialsSortBy, setMaterialsSortBy] = useState<string>('Newest');
  const [openUploadModal, setOpenUploadModal] = useState<boolean>(false);
  const [activeCommentsMaterialId, setActiveCommentsMaterialId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [savedMaterialIds, setSavedMaterialIds] = useState<string[]>([]);

  const [activeChatTargetId, setActiveChatTargetId] = useState<string>('group-all');
  const [chatSearchQuery, setChatSearchQuery] = useState<string>('');
  const [previewMaterial, setPreviewMaterial] = useState<MaterialResource | null>(null);
  const [shareMaterial, setShareMaterial] = useState<MaterialResource | null>(null);
  const [showChatSidebarMobile, setShowChatSidebarMobile] = useState<boolean>(true);


  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [materials, setMaterials] = useState<MaterialResource[]>([]);
  const [feedbackPosts, setFeedbackPosts] = useState<FeedbackPost[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState<boolean>(false);
  const [notesViewMode, setNotesViewMode] = useState<'vault' | 'collaborative'>('collaborative');
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [showGroupSettings, setShowGroupSettings] = useState<boolean>(false);
  const [newRoomType, setNewRoomType] = useState<'group' | 'friend' | 'channel'>('group');
  const [newRoomIcon, setNewRoomIcon] = useState<string>('💬');
  const [newRoomDescription, setNewRoomDescription] = useState<string>('');
  const [housePoints, setHousePoints] = useState<{ [key in HouseType]: number }>({
    Ruby: 1450,
    Emerald: 1200,
    Sapphire: 1150,
    Topaz: 1300
  });

  // Onboarding Login form states
  const [authRole, setAuthRole] = useState<UserRole>('student');
  const [authName, setAuthName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authGrade, setAuthGrade] = useState<string>('Grade 10');
  const [authSection, setAuthSection] = useState<SectionType>('Solara');
  const [authHouse, setAuthHouse] = useState<HouseType>('Emerald');
  const [authSpecialty, setAuthSpecialty] = useState<string>('Physics');
  const [authRollNumber, setAuthRollNumber] = useState<string>('');
  const [authDepartment, setAuthDepartment] = useState<string>('');
  const [authSubjects, setAuthSubjects] = useState<string>('');
  const [authDesignation, setAuthDesignation] = useState<string>('');
  const [authPin, setAuthPin] = useState<string>('');

  // Recent Accounts States
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>(() => {
    try {
      const cached = localStorage.getItem('s_os_recent_accounts');
      return (cached && cached !== "undefined") ? JSON.parse(cached) : [];
    } catch (_) { return []; }
  });
  const [securityVerificationAcc, setSecurityVerificationAcc] = useState<RecentAccount | null>(null);
  const [pinVerificationError, setPinVerificationError] = useState<string>('');
  const [enteredVerificationPin, setEnteredVerificationPin] = useState<string>('');
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);

  // Input States for New Entries
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [newNoteSubject, setNewNoteSubject] = useState<string>('Physics');
  const [newMaterialTitle, setNewMaterialTitle] = useState<string>('');
  const [newMaterialDesc, setNewMaterialDesc] = useState<string>('');
  const [newMaterialSubject, setNewMaterialSubject] = useState<string>('Physics');
  const [newMaterialType, setNewMaterialType] = useState<'pdf' | 'link' | 'formula-sheet'>('pdf');
  const [newFeedbackText, setNewFeedbackText] = useState<string>('');
  const [newFeedbackCategory, setNewFeedbackCategory] = useState<'facilities' | 'academic' | 'events'>('facilities');
  const [newChatText, setNewChatText] = useState<string>('');
  const [joinRoomCode, setJoinRoomCode] = useState<string>('');

  // Persistent Light/Dark/Auto Theme System State
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>(() => {
    return (localStorage.getItem('s_os_theme') as any) || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'light') {
      root.classList.add('light-theme');
    } else if (themeMode === 'dark') {
      root.classList.remove('light-theme');
    } else {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        root.classList.remove('light-theme');
      } else {
        root.classList.add('light-theme');
      }
    }
    localStorage.setItem('s_os_theme', themeMode);
  }, [themeMode]);

  // AI Chat states
  const [selectedPersona, setSelectedPersona] = useState<string>('study_buddy');
  const [aiInput, setAiInput] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiMode, setAiMode] = useState<'explanatory' | 'socratic' | 'coder' | 'quiz_gen'>('explanatory');

  const [aiThreads, setAiThreads] = useState<{
    id: string;
    title: string;
    personaId: string;
    mode: 'explanatory' | 'socratic' | 'coder' | 'quiz_gen';
    messages: {
      role: 'user' | 'assistant';
      content: string;
      files?: any[];
      webSources?: { title: string; url: string; domain: string; snippet?: string; sourceType?: string }[];
      webSearchUsed?: boolean;
    }[];
    attachedFile?: { name: string; content: string; size: number; type: string } | null;
    attachedFiles?: any[];
    userId?: string;
    createdAt?: number;
    isPinned?: boolean;
  }[]>(() => {
    try {
      const cached = localStorage.getItem('s_os_ai_threads');
      if (cached && cached !== "undefined") {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const cachedUser = localStorage.getItem('s_os_user');
          if (cachedUser) {
            const user = JSON.parse(cachedUser);
            if (user?.uid) {
              return parsed.filter((t: any) => t.userId === user.uid);
            }
          }
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    try {
      const cachedUser = localStorage.getItem('s_os_user');
      if (cachedUser) {
        const user = JSON.parse(cachedUser);
        if (user?.uid) {
          const cachedActive = localStorage.getItem(`s_os_ai_active_id_${user.uid}`);
          if (cachedActive) return cachedActive;
        }
      }
      const cachedActive = localStorage.getItem('s_os_ai_active_id');
      if (cachedActive) return cachedActive;
    } catch (e) {}
    return '';
  });

  const [aiThreadHoldMenu, setAiThreadHoldMenu] = useState<{ threadId: string, x: number, y: number } | null>(null);

  const handlePinThread = (threadId: string) => {
    setAiThreads(prev => {
      const updated = prev.map(t => t.id === threadId ? { ...t, isPinned: !t.isPinned } : t);
      return updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    });
    setAiThreadHoldMenu(null);
  };

  const handleRenameThread = async (threadId: string) => {
    const thread = aiThreads.find(t => t.id === threadId);
    if (!thread) return;
    const newTitle = window.prompt('Enter new title:', thread.title);
    if (newTitle && newTitle.trim() && currentUser?.uid) {
      setAiThreads(prev => prev.map(t => t.id === threadId ? { ...t, title: newTitle } : t));
      await renameAiBuddyChat(threadId, newTitle, currentUser.uid);
    }
    setAiThreadHoldMenu(null);
  };





  // Derived current thread state helper
  const activeThread = aiThreads.find(t => t.id === activeThreadId) || aiThreads[0] || {
    id: 'thread-default',
    title: 'Introductory Study Unit',
    personaId: 'study_buddy',
    mode: 'explanatory' as const,
    messages: [],
    attachedFile: null,
    attachedFiles: [],
    createdAt: Date.now(),
    userId: currentUser?.uid || ''
  };

  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; size: number; type: string }[]>([]);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<string | null>(null);
  const [aiActiveModelLabel, setAiActiveModelLabel] = useState<string>('');
  const [aiGroundedInData, setAiGroundedInData] = useState<boolean>(false);
  const [aiWebSearchMode, setAiWebSearchMode] = useState<'auto' | 'force' | 'off'>('auto');
  const [aiModelOverride, setAiModelOverride] = useState<string>('');
  const [aiStatusMessage, setAiStatusMessage] = useState<string>('');
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  // AI Quota & Limits State
  const [aiUsageState, setAiUsageState] = useState<AIUsageState>(() => 
    getLocalUsageState(currentUser?.uid || 'guest', effectiveRole || 'student')
  );
  const [showQuotaModal, setShowQuotaModal] = useState<boolean>(false);
  const [showAiHistoryDrawer, setShowAiHistoryDrawer] = useState<boolean>(false);
  const [selectedTopicForTutor, setSelectedTopicForTutor] = useState<string | null>(null);
  const [aiReasoningMode, setAiReasoningMode] = useState<boolean>(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = aiFileInputRef.current;
    if (!el) return;
    const handleCancel = () => {
      setTimeout(() => {
        (window as any).__studentos_file_picker_active__ = false;
      }, 1000);
    };
    el.addEventListener('cancel', handleCancel);
    return () => el.removeEventListener('cancel', handleCancel);
  }, []);

  function detectTeachingIntent(query: string): string | null {
    const lower = query.toLowerCase().trim();
    const patterns = [
      /^teach me (about )?(.+)/i,
      /^explain (this chapter|this topic|about )?(.+)/i,
      /^can you teach me (.+)/i,
      /^i don't understand (.+)/i,
      /^help me learn (.+)/i,
      /^explain (.+) in simple words/i,
      /^how does (.+) work/i,
    ];
    for (const p of patterns) {
      const m = lower.match(p);
      if (m) {
        return (m[2] || m[1] || query).replace(/[?.!]/g, '').trim();
      }
    }
    if (lower.startsWith('teach ') || lower.startsWith('learn ') || lower.includes('step by step')) {
      return query.replace(/^(teach me|teach|learn|explain|can you explain|help me learn about)\s+/i, '').replace(/[?.!]/g, '').trim();
    }
    return null;
  }

  // Sync AI Usage status dynamically
  useEffect(() => {
    fetchAIUsageStatus(currentUser?.uid || 'guest', effectiveRole || 'student').then(setAiUsageState);

    const handleQuotaEvent = (e: any) => {
      if (e.detail) setAiUsageState(e.detail);
    };
    window.addEventListener('s_os_ai_quota_updated', handleQuotaEvent);
    return () => window.removeEventListener('s_os_ai_quota_updated', handleQuotaEvent);
  }, [currentUser?.uid, effectiveRole, activeTab]);

  // User Activity Tracker for Auto-Lock
  useEffect(() => {
    if (autoLockTime <= 0 || isLocked || !currentUser || !['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '')) return;

    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('mousemove', handleActivity);

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= autoLockTime * 60 * 1000) {
        if (hasPinConfigured) {
          setIsLocked(true);
          lockWorkspace({ userId: currentUser?.uid, userName: currentUser?.name }).catch(console.error);
          showNotification('⏰ Workspace locked due to inactivity.');
        }
      }
    }, 5000); // Check every 5 seconds

    return () => {
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      clearInterval(interval);
    };
  }, [autoLockTime, lastActivity, isLocked, effectiveRole, currentUser, hasPinConfigured]);

  // Authoritative Security State Fetch & Cross-Device Realtime Subscription
  useEffect(() => {
    let isMounted = true;
    async function initSecurity() {
      setIsSecurityChecking(true);
      try {
        const sec = await getSecurityStatus();
        if (isMounted) {
          setIsLocked(sec.isLocked);
          setHasPinConfigured(sec.hasPinConfigured);
        }
      } catch (err) {
        console.error('[Security] Failed to fetch authoritative security state:', err);
        if (isMounted) {
          setSecurityStatusError('Security verification failed. Operating in secure mode.');
        }
      } finally {
        if (isMounted) {
          setIsSecurityChecking(false);
        }
      }
    }
    initSecurity();

    const unsubscribe = subscribeToWorkspaceLockChanges((remoteLocked) => {
      if (isMounted) {
        setIsLocked(remoteLocked);
        if (remoteLocked) {
          showNotification('🔒 Workspace locked by authorized session.');
        } else {
          showNotification('🔓 Workspace unlocked.');
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Keyboard support for Lock Screen numeric entry
  useEffect(() => {
    if (!isLocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture if typing in another input element
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key >= '0' && e.key <= '9') {
        if (lockScreenPinInput.length < 6) {
          setLockScreenPinInput(prev => prev + e.key);
          setLockScreenError('');
        }
      } else if (e.key === 'Backspace') {
        setLockScreenPinInput(prev => prev.slice(0, -1));
        setLockScreenError('');
      } else if (e.key === 'Enter') {
        handleUnlockWithPin();
      } else if (e.key === 'Escape') {
        setLockScreenPinInput('');
        setLockScreenError('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, lockScreenPinInput]);


  // Session & Permission Protection
  useEffect(() => {
    if (currentUser) {
      const forbiddenTabsForStudent = ['faculty', 'attendance_manager', 'admin', 'panel_mode'];
      if (effectiveRole === 'student' && forbiddenTabsForStudent.includes(activeTab)) {
        setActiveTab('dashboard');
        showNotification('🚫 Restricted Area: Students are not authorized to view this resource.');
      }
    }
  }, [activeTab, effectiveRole, currentUser]);

  // Local cached sync for active thread, avoiding complex initial hydration errors
  useEffect(() => {
    const cachedActive = localStorage.getItem(`s_os_ai_active_id_${currentUser?.uid}`);
    if (cachedActive && currentUser) setActiveThreadId(cachedActive);
  }, [currentUser?.uid]);

  // Sync active thread ID locally
  useEffect(() => {
    if (currentUser?.uid) {
      localStorage.setItem(`s_os_ai_active_id_${currentUser.uid}`, activeThreadId);
    }
  }, [activeThreadId, currentUser]);

  // Sync active mode, attached files, and active tutor when changing threads
  useEffect(() => {
    if (activeThread) {
      setAiMode(activeThread.mode || 'explanatory');
      setSelectedPersona(activeThread.personaId || 'study_buddy');
      if (activeThread.attachedFiles) {
        setAttachedFiles(activeThread.attachedFiles);
      } else if (activeThread.attachedFile) {
        setAttachedFiles([activeThread.attachedFile]);
      } else {
        setAttachedFiles([]);
      }
    }
  }, [activeThreadId]);

  // Whiteboard Canvas State
  const whiteboardRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#6366f1');
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [brushSize, setBrushSize] = useState<number>(4);
  const [canvasTool, setCanvasTool] = useState<string>('pen');
  const [canvasMode, setCanvasMode] = useState<'grid' | 'ruled' | 'blank'>('blank');
  
  // Whiteboard Slides
  const [whiteboardSlides, setWhiteboardSlides] = useState<string[]>(['']);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);


  // Interactive Quiz States
  const [quizSubject, setQuizSubject] = useState<string>('Physics');
  const [quizStarted, setQuizStarted] = useState<boolean>(false);
  const [quizCurrentIndex, setQuizCurrentIndex] = useState<number>(0);
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [quizScore, setQuizScore] = useState<number>(0);
  const [quizTimer, setQuizTimer] = useState<number>(15);
  const quizTimerRef = useRef<any>(null);

  // Classroom Live stream states
  const [studentJoinedClass, setStudentJoinedClass] = useState<boolean>(false);
  const [activeBroadcast, setActiveBroadcast] = useState<Lesson | null>(null);
  const [understandingSignals, setUnderstandingSignals] = useState<{ [key: string]: number }>({
    understood: 14,
    confused: 2,
    awesome: 8
  });

  // Quick Sidebar Uploader States
  const [quickUploadDragActive, setQuickUploadDragActive] = useState<boolean>(false);
  const [quickUploadFile, setQuickUploadFile] = useState<File | null>(null);
  const [quickUploadTitle, setQuickUploadTitle] = useState<string>('');
  const [quickUploadSubject, setQuickUploadSubject] = useState<string>('Mathematics');
  const [quickUploadType, setQuickUploadType] = useState<string>('notes');
  const [quickUploadIsUploading, setQuickUploadIsUploading] = useState<boolean>(false);

  // Pomodoro Focus Timer States
  const [pomodoroSeconds, setPomodoroSeconds] = useState<number>(1500); // 25:00
  const [customPomodoro, setCustomPomodoro] = useState<number>(1500); // 25:00
  const [pomodoroRunning, setPomodoroRunning] = useState<boolean>(false);
  const [pomodoroMode, setPomodoroMode] = useState<'focus' | 'short_break' | 'long_break'>('focus');
  const [pomodoroCompletedCount, setPomodoroCompletedCount] = useState<number>(() => {
    return Number(localStorage.getItem('s_os_pomodoro_sessions_today') || 0);
  });
  const [pomodoroJustCompleted, setPomodoroJustCompleted] = useState<boolean>(false);
  const [showPomodoroSettings, setShowPomodoroSettings] = useState<boolean>(false);
  const [timerH, setTimerH] = useState<number>(0);
  const [timerM, setTimerM] = useState<number>(25);
  const [timerS, setTimerS] = useState<number>(0);
  const pomodoroIntervalRef = useRef<any>(null);
  const pomodoroEndTimeRef = useRef<number | null>(null);
  const pomodoroCompletionGuardRef = useRef<boolean>(false);

  // Auth & Assignment Filter UI States
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [hwStatusFilter, setHwStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Study Planner States
  const [schSubject, setSchSubject] = useState<string>('');
  const [schTime, setSchTime] = useState<string>('');
  const [schDay, setSchDay] = useState<string>('Monday');

  // Student Profile Editorial States
  const [profileNameInput, setProfileNameInput] = useState<string>('');
  const [profileNameError, setProfileNameError] = useState<string>('');
  const [profileGradeInput, setProfileGradeInput] = useState<string>('');
  const [profileSectionInput, setProfileSectionInput] = useState<SectionType>('Solara');
  const [profileHouseInput, setProfileHouseInput] = useState<HouseType>('Emerald');
  const [profileAvatar, setProfileAvatar] = useState<string>('https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop');

  // Synchronize profile credentials on account update
  useEffect(() => {
    if (currentUser) {
      setProfileNameInput(currentUser.name || '');
      setProfileGradeInput(currentUser.grade || '');
      setProfileSectionInput(currentUser.section || 'Solara');
      setProfileHouseInput(currentUser.house || 'Emerald');
      setProfileAvatar(currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop');
    }
  }, [currentUser]);

  const getNotificationEmoji = (type: string) => {
    switch (type) {
      case 'notice': return '📢';
      case 'assignment': return '📚';
      case 'worksheet': return '📝';
      case 'homework': return '✏️';
      case 'attendance': return '📅';
      case 'marks': return '💯';
      default: return '🔔';
    }
  };

  // Handle custom system notification creation events
  useEffect(() => {
    const handleNotificationCreated = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data) return;

      const title = data.title || 'New System Notice';
      const message = data.message || data.content || '';
      const type = data.type || 'notice';

      saveAppNotification({
        id: generateUUID(),
        title,
        message,
        type,
        createdAt: new Date().toISOString(),
        isRead: false,
        targetClass: data.targetGrades && data.targetGrades.length > 0 ? data.targetGrades[0] : 'all',
        targetSection: data.targetSections && data.targetSections.length > 0 ? data.targetSections[0] : 'all',
        linkTab: data.linkTab || 'notice_viewer'
      }).then(() => {
        showNotification(`🔔 ${title}`);
      });
    };

    window.addEventListener('s_os_notification_created', handleNotificationCreated);
    return () => {
      window.removeEventListener('s_os_notification_created', handleNotificationCreated);
    };
  }, []);

  // Persist ttsEnabled state to localStorage on modification
  useEffect(() => {
    localStorage.setItem('s_os_tts_enabled', String(ttsEnabled));
  }, [ttsEnabled]);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await markNotificationAsRead(notifId, currentUser?.uid);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
      awardStudentXP(currentUser, 'read_notice', { uniqueItemId: notifId });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(notifications, currentUser?.uid);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      showNotification('✓ All notifications marked read.');
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleDeleteNotif = async (notifId: string) => {
    try {
      await deleteNotification(notifId, currentUser?.uid);
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      showNotification('Notification removed.');
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  // Toasts Notification State
  const [toasts, setToasts] = useState<{ id: string; msg: string }[]>([]);

  // Effect to manage real clock timing
  useEffect(() => {
    const tInterval = setInterval(() => {
      const live = new Date();
      setClock(live.toLocaleTimeString());
    }, 1000);
    return () => clearInterval(tInterval);
  }, []);

  // Detect and initialize Password Reset flow from email link
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('reset_token');
    if (token) {
      setResetToken(token);
      setRegStep('reset-password');
      // Clean URL for aesthetics and security
      window.history.replaceState(null, '', window.location.pathname);
      showNotification('🔑 Reset token detected. Please set your new password.');
    }
  }, []);

  const handleForgotPassword = async () => {
    if (!loginEmail.trim()) {
      showNotification('Please enter your school email first.');
      return;
    }
    
    try {
      const resp = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim() })
      });
      
      const data = await resp.json();
      if (resp.ok) {
        showNotification('✅ ' + data.message);
      } else {
        showNotification('⚠️ ' + (data.error || 'Failed to send reset link.'));
      }
    } catch (err) {
      showNotification('⚠️ Network error. Please try again.');
    }
  };

  const handleConfirmResetPassword = async () => {
    if (!resetToken || !newResetPassword) return;
    if (newResetPassword.length < 6) {
      showNotification('⚠️ Password must be at least 6 characters long.');
      return;
    }
    if (newResetPassword !== confirmResetPassword) {
      showNotification('⚠️ Passwords do not match.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          password: newResetPassword
        })
      });

      const data = await resp.json();
      if (resp.ok) {
        showNotification('✅ ' + data.message);
        setRegStep('login');
        setResetToken(null);
        setNewResetPassword('');
        setConfirmResetPassword('');
      } else {
        showNotification('⚠️ ' + (data.error || 'Failed to reset password.'));
      }
    } catch (err) {
      showNotification('⚠️ Connection error. Please try again.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Restore persisted Pomodoro state on mount or PWA reopen
  useEffect(() => {
    try {
      const saved = localStorage.getItem('s_os_pomodoro_active_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mode) setPomodoroMode(parsed.mode);
        if (parsed.customPomodoro) setCustomPomodoro(parsed.customPomodoro);
        if (parsed.running && parsed.endTime) {
          const remaining = Math.max(0, Math.ceil((parsed.endTime - Date.now()) / 1000));
          if (remaining > 0) {
            pomodoroEndTimeRef.current = parsed.endTime;
            setPomodoroSeconds(remaining);
            setPomodoroRunning(true);
          } else {
            setPomodoroSeconds(0);
            setPomodoroRunning(false);
            setPomodoroJustCompleted(true);
            localStorage.removeItem('s_os_pomodoro_active_state');
          }
        } else if (typeof parsed.remainingSeconds === 'number' && parsed.remainingSeconds > 0) {
          setPomodoroSeconds(parsed.remainingSeconds);
        }
      }
    } catch (_) {}
  }, []);

  // Effect to handle Pomodoro countdown ticks with timestamp accuracy (immune to background tab throttling)
  useEffect(() => {
    if (pomodoroRunning) {
      pomodoroCompletionGuardRef.current = false;
      if (!pomodoroEndTimeRef.current) {
        pomodoroEndTimeRef.current = Date.now() + pomodoroSeconds * 1000;
      }
      localStorage.setItem('s_os_pomodoro_active_state', JSON.stringify({
        running: true,
        endTime: pomodoroEndTimeRef.current,
        mode: pomodoroMode,
        customPomodoro,
        remainingSeconds: pomodoroSeconds
      }));

      const syncRemaining = () => {
        if (!pomodoroEndTimeRef.current) return;
        const remaining = Math.max(0, Math.ceil((pomodoroEndTimeRef.current - Date.now()) / 1000));
        if (remaining <= 0) {
          if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
          pomodoroEndTimeRef.current = null;
          setPomodoroRunning(false);
          setPomodoroSeconds(0);
          setPomodoroJustCompleted(true);
          localStorage.removeItem('s_os_pomodoro_active_state');

          if (!pomodoroCompletionGuardRef.current) {
            pomodoroCompletionGuardRef.current = true;
            if (pomodoroMode === 'focus') {
              const nextCount = pomodoroCompletedCount + 1;
              setPomodoroCompletedCount(nextCount);
              localStorage.setItem('s_os_pomodoro_sessions_today', String(nextCount));
              if (currentUser?.house) {
                setHousePoints(prev => ({
                  ...prev,
                  [currentUser.house!]: (prev[currentUser.house!] || 700) + 50
                }));
              }
              if (currentUser) {
                const updated = {
                  ...currentUser,
                  studyHours: (currentUser.studyHours || 12) + 1
                };
                setCurrentUser(updated);
                localStorage.setItem('s_os_user', JSON.stringify(updated));
              }
              showNotification('Focus session completed! +50 House Points & +1h study time logged.');
            } else {
              showNotification('Break finished! Ready for your next focus session.');
            }
            soundService.playTimerAlarm();
          }
        } else {
          setPomodoroSeconds(remaining);
        }
      };

      pomodoroIntervalRef.current = setInterval(syncRemaining, 500);
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') syncRemaining();
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    } else {
      pomodoroEndTimeRef.current = null;
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current);
      }
      if (!pomodoroJustCompleted) {
        localStorage.setItem('s_os_pomodoro_active_state', JSON.stringify({
          running: false,
          endTime: null,
          mode: pomodoroMode,
          customPomodoro,
          remainingSeconds: pomodoroSeconds
        }));
      }
    }
  }, [pomodoroRunning, pomodoroMode, customPomodoro, currentUser, pomodoroCompletedCount, pomodoroJustCompleted]);

  // System Notification Handler (Quick Action Completion Toasts & Alerts)
  const safePlayNotificationSound = () => {
    try {
      soundService.playShortDigitalAlert();
    } catch (_) {}
  };

  const showNotification = (msg: string) => {
    const id = generateUniqueId();
    setToasts(prev => [...prev, { id, msg }]);
    safePlayNotificationSound();
    if (ttsEnabled) {
      speakText(msg);
    }
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Speaks aloud with Web Speech Synthesis
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      setTimeout(() => {
        const cleanText = text.replace(/[#*_`]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05;
        utterance.onerror = () => {};
        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (_) {}
  };

  // --- PHASE 2 CORE ECOSYSTEM EVENT LISTENERS ---
  useEffect(() => {
    const handleCreateNoteEvent = (e: Event) => {
      const customEvt = e as CustomEvent;
      const { title, content, subject } = customEvt.detail;
      if (!currentUser) return;
      const uid = currentUser.uid;
      const defaultCover = 'bg-gradient-to-r from-violet-600 to-indigo-900';
      const newId = generateUniqueId();
      const newNote = {
        id: newId,
        title: title || 'AI Research Notes Page',
        subject: subject || 'Syllabus General',
        content: content || '',
        createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        icon: '🧠',
        coverBg: defaultCover,
        userId: uid
      };
      setVaultNotes(prev => {
        const updated = [...prev, newNote];
        (async () => {
       const newArr = updated;
       for (const n of newArr) {
          saveVaultNoteToSupabase(n).catch(()=>{});
       }
     })();
        return updated;
      });
      setSelectedNoteId(newId);
      setNoteEditMode(true);
      showNotification(`✓ Custom AI Notes saved in your Vault!`);
    };

    const handleAddScheduleEvent = (e: Event) => {
      const customEvt = e as CustomEvent;
      const { subject, day, time } = customEvt.detail;
      if (!currentUser) return;
      const uid = currentUser.uid;
      const newSch = {
        id: generateUniqueId(),
        subject,
        day,
        time,
        userId: uid
      };
      setSchedules(prev => {
        const updated = [...prev, newSch];
        if (currentUser) {
          const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), schedules: updated } };
          setCurrentUser(updatedUser);
          saveSupabaseUserProfile(updatedUser).catch(e => {});
        }
        return updated;
      });
      showNotification(`✓ Study Slot: ${subject} added to study planner!`);
    };

    const handleAddTaskEvent = (e: any) => {
      const { title, dueDate, subject } = e.detail || {};
      if (!title || !currentUser) return;
      const uid = currentUser.uid;
      const taskId = generateUniqueId();
      const item: Task = {
        id: taskId,
        title,
        completed: false,
        dueDate: dueDate || 'Tomorrow',
        subject: subject || currentUser?.specialtySubject || 'General',
        userId: uid,
        createdAt: new Date().toISOString()
      };
      setTasks(prev => {
        const updated = [...prev, item];
        if (currentUser) {
          const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), tasks: updated } };
          setCurrentUser(updatedUser);
          saveSupabaseUserProfile(updatedUser).catch(e => {});
        }
        return updated;
      });
      showNotification(`✓ Task: "${title}" added to Task Manager!`);
    };

    const handleCompleteTaskEvent = (e: any) => {
      const { title } = e.detail || {};
      setTasks(prev => {
        const updated = prev.map(t => (t.id === title || (title && t.title.toLowerCase().includes(title.toLowerCase()))) ? { ...t, completed: true } : t);
        if (currentUser) {
          const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), tasks: updated } };
          setCurrentUser(updatedUser);
          saveSupabaseUserProfile(updatedUser).catch(e => {});
        }
        return updated;
      });
      showNotification(`🎉 Task marked completed!`);
    };

    const handleDeleteTaskEvent = (e: any) => {
      const { title } = e.detail || {};
      setTasks(prev => {
        const updated = prev.filter(t => !(t.id === title || (title && t.title.toLowerCase().includes(title.toLowerCase()))));
        if (currentUser) {
          const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), tasks: updated } };
          setCurrentUser(updatedUser);
          saveSupabaseUserProfile(updatedUser).catch(e => {});
        }
        return updated;
      });
      showNotification(`Task deleted.`);
    };

    window.addEventListener('s_os_create_note', handleCreateNoteEvent);
    window.addEventListener('s_os_add_schedule', handleAddScheduleEvent);
    window.addEventListener('s_os_add_task', handleAddTaskEvent);
    window.addEventListener('s_os_complete_task', handleCompleteTaskEvent);
    window.addEventListener('s_os_delete_task', handleDeleteTaskEvent);
    return () => {
      window.removeEventListener('s_os_create_note', handleCreateNoteEvent);
      window.removeEventListener('s_os_add_schedule', handleAddScheduleEvent);
      window.removeEventListener('s_os_add_task', handleAddTaskEvent);
      window.removeEventListener('s_os_complete_task', handleCompleteTaskEvent);
      window.removeEventListener('s_os_delete_task', handleDeleteTaskEvent);
    };
  }, [currentUser]);

  // Firebase Authentication & Collaborative Real-Time Database Synchronizations
  useEffect(() => {
    console.log('[Auth-Init] Initializing Supabase Auth listeners. Starting 4.5s loading safety timeout.');
    
    // Safety fallback timer: ensure loading screen NEVER gets stuck forever
    const safetyTimer = setTimeout(() => {
      setFirebaseLoading(prev => {
        if (prev) console.warn('[Auth-Init] ⚠️ Safety Timeout: Force-resolving stuck firebaseLoading!');
        return false;
      });
      setDataLoading(prev => {
        if (prev) console.warn('[Auth-Init] ⚠️ Safety Timeout: Force-resolving stuck dataLoading!');
        return false;
      });
    }, 4500); // 4.5 seconds maximum startup wait time

    if (isDemoMode) {
      const demoStudent = {
        uid: 'demo-student-uid',
        name: 'Naitik Kashyap',
        email: 'naitik.kashyap0015@gmail.com',
        role: 'student' as const,
        grade: 'Grade 10',
        section: 'Ruby' as any,
        house: 'Ruby' as any,
        studyHours: 14,
        quizzesTaken: 5,
        streakDays: 8,
        accountStatus: 'approved' as const
      };
      setCurrentUser(demoStudent);
      setFirebaseLoading(false);
      return;
    }

    // Listen for auth success messages if we are the parent window
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
        console.log('[Auth] Parent received OAuth success message from popup!');
        showNotification('✅ Google Sign-In successful! Loading your academic workspace...');
        setFirebaseLoading(true);
        setDataLoading(true);
        
        const hash = event.data?.hash || '';
        const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
        const params = new URLSearchParams(cleanHash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          }).then(({ data, error }) => {
            if (error) {
              console.error('[Auth] Failed to set session from popup hash:', error);
              window.location.reload();
            } else {
              console.log('[Auth] Session successfully established in parent!');
            }
          }).catch(err => {
            console.error('[Auth] Error setting session from popup hash:', err);
            window.location.reload();
          });
        } else {
          supabase.auth.getSession().then(({ data }) => {
            if (!data?.session) {
              window.location.reload();
            }
          });
        }
      }
    };
    window.addEventListener('message', handleAuthMessage);

    let hasExchanged = false;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const hasHashParams = window.location.hash.includes('access_token=') || window.location.hash.includes('id_token=');

    if (code && !hasExchanged) {
      hasExchanged = true;
      setFirebaseLoading(true);
      setDataLoading(true);

      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {}
          if (error) {
            console.error('[Auth] Code exchange failed:', error);
            setFirebaseLoading(false);
            setDataLoading(false);
            showNotification(`⚠️ Google Sign-In failed: ${error.message}`);
          }
        })
        .catch(err => {
          console.error('[Auth] Unexpected error in code exchange:', err);
          try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {}
          setFirebaseLoading(false);
          setDataLoading(false);
        });
    } else if (hasHashParams) {
      // The Supabase SDK (detectSessionInUrl: true + flowType: 'implicit') already
      // parsed the hash and stored the session locally before this code runs.
      // We just need to read it back with getSession() — no server call needed.
      // DO NOT call setSession() here: it makes a server round-trip that requires
      // the anon key and will fail with 401 if the key is misconfigured.
      setFirebaseLoading(true);
      setDataLoading(true);

      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      // Always use getSession() — the SDK already processed the hash automatically
      Promise.resolve(supabase.auth.getSession()).then(({ data, error }) => {
        if (data?.session) {
          try { window.history.replaceState({}, document.title, window.location.pathname); } catch(e) {}
        } else {
          console.error('[Auth] No session after hash redirect:', error);
          if (error) showNotification(`⚠️ Sign-in failed: ${error.message}`);
          try { window.history.replaceState({}, document.title, window.location.pathname); } catch(e) {}
          setFirebaseLoading(false);
          setDataLoading(false);
        }
      }).catch(err => {
        console.error('[Auth] Exception reading session after hash:', err);
        setFirebaseLoading(false);
        setDataLoading(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Byte Bug 1: While file picker is open or active, ignore auth session changes and do not restore another account
      if ((window as any).__studentos_file_picker_active__) {
        console.log('[Auth] File picker is active: ignoring onAuthStateChange event to keep active account locked.');
        return;
      }

      // Keep currentUser locked to account A until the user explicitly switches or logs out
      if (currentUserRef.current && !session && !(window as any).__studentos_explicit_logout__) {
        console.log('[Auth] Ignoring empty session; keeping active account locked:', currentUserRef.current.name);
        setFirebaseLoading(false);
        setDataLoading(false);
        return;
      }

      const isAuthInProgress = window.location.hash.includes('access_token=') || 
                               window.location.search.includes('code=') || 
                               window.location.hash.includes('id_token=');
      
      const isAlreadyShown = (() => {
        try { return sessionStorage.getItem('s_os_startup_shown') === 'true'; } catch (_) { return false; }
      })();

      if (event === 'SIGNED_IN' && !currentUser && session && !isAlreadyShown) {
        setShowStartup(true);
        setFirebaseLoading(true);
        setDataLoading(true);
      }

      // Handle active OAuth redirect in progress before session is parsed
      if (isAuthInProgress && !session) {
        setFirebaseLoading(true);
        if (!(window as any).__studentos_auth_timeout__) {
          (window as any).__studentos_auth_timeout__ = setTimeout(() => {
            setFirebaseLoading(false);
            setDataLoading(false);
            delete (window as any).__studentos_auth_timeout__;
          }, 8000);
        }
        return;
      }

      // If we made it here, the session is loaded or isAuthInProgress is false. Clear any safety timeouts.
      if ((window as any).__studentos_auth_timeout__) {
        clearTimeout((window as any).__studentos_auth_timeout__);
        delete (window as any).__studentos_auth_timeout__;
      }

      // If auth parameters were present and we now have a session, strip them immediately to prevent re-exchange on page reload.
      if (isAuthInProgress && session) {
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          console.error('[Auth] Failed to clear URL credentials:', err);
        }
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        return;
      }

      const supabaseUser = session?.user;

      if (supabaseUser) {
        setFirebaseOnboardingUser(supabaseUser as any);

        try {
          
          const isWhitelisted = supabaseUser.email && [
            'naitik.kashyap0015@gmail.com',
            'naitik.kashyap5205@gmail.com'
          ].includes(supabaseUser.email.toLowerCase());

          let profile: UserProfile | null = null;
          let isTableMissing = false;

          try {
            profile = await getSupabaseUserProfile(supabaseUser.id, supabaseUser.email);
          } catch (sbErr: any) {
            console.error('[Auth] Failed to fetch user profile:', sbErr);
            isTableMissing = true;
          }

          if (profile) {
            if (isWhitelisted && (profile.role !== 'super_admin' || profile.accountStatus !== 'approved')) {
              profile.role = 'super_admin';
              profile.accountStatus = 'approved';
              try {
                profile = await saveSupabaseUserProfile(profile);
              } catch (e) {
                console.error('[Auth] Failed to update whitelisted user role:', e);
              }
            }

            setCurrentUser(profile);
            localStorage.setItem('s_os_user', JSON.stringify(profile));
            updateRecentAccounts(profile);
            setDataLoading(false);
            showNotification(`Welcome back, ${profile.name}! ✅`);
          } else {
            // Automatically create profile for OAuth users
            console.log('[Auth] Profile not found for OAuth user. Auto-creating profile.');

            const newProfile: UserProfile = {
              uid: supabaseUser.id,
              name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || (isWhitelisted ? 'Super Admin' : 'Student'),
              email: supabaseUser.email || `${supabaseUser.id}@temp.user.com`,
              photoURL: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || '',
              role: isWhitelisted ? 'super_admin' : 'student',
              requestedRole: 'student',
              accountStatus: 'approved',
              studyHours: 0,
              quizzesTaken: 0,
              streakDays: 0,
              lastLogin: Date.now()
            };

            if (isTableMissing) {
              profile = newProfile;
              showNotification('⚠️ Supabase "users" table not found or inaccessible. Running in offline/demo mode.');
            } else {
              try {
                profile = await saveSupabaseUserProfile(newProfile);
                showNotification(`Welcome to Veylentra, ${profile.name}! 🎉`);
              } catch (sbCreateErr: any) {
                console.error('[Auth] Failed to auto-create user profile:', sbCreateErr);
                profile = newProfile;
                showNotification('⚠️ Database save failed. Running with offline user profile.');
              }
            }

            setCurrentUser(profile);
            localStorage.setItem('s_os_user', JSON.stringify(profile));
            updateRecentAccounts(profile);
            setDataLoading(false);
          }
        } catch (err: any) {
          console.error('[Auth] Profile load error:', err);
          setAuthError({
            code: err.code || 'supabase/read-error',
            message: 'Role Load Failed: ' + (err.message || String(err)),
            hostname: window.location.hostname
          });
          
          showNotification(`⚠️ Role Load Failed: ${err.message || String(err)}`);
          
          setCurrentUser(null);
          localStorage.removeItem('s_os_user');
          setFirebaseLoading(false);
          setShowStartup(false);
          setDataLoading(false);
        }
      } else {
        if (!isAuthInProgress) {
          // Keep active account locked unless user explicitly clicked logout
          if (currentUserRef.current && !(window as any).__studentos_explicit_logout__) {
            console.log('[Auth] Preserving active account across transient empty session:', currentUserRef.current.name);
            setFirebaseLoading(false);
            setDataLoading(false);
            return;
          }

          const cachedUserStr = localStorage.getItem('s_os_user');
          let isDemoUser = false;
          if (cachedUserStr) {
            try {
              const u = JSON.parse(cachedUserStr);
              if (u?.uid && (u.uid.startsWith('demo-') || u.isDemo || u.isLocalAuth || u.uid.startsWith('usr-') || u.uid.startsWith('manual-') || u.email)) {
                isDemoUser = true;
              }
            } catch (_) {}
          }
          if (!isDemoUser && (window as any).__studentos_explicit_logout__) {
            setFirebaseOnboardingUser(null);
            setCurrentUser(null);
            localStorage.removeItem('s_os_user');
            setDataLoading(false);
          } else {
            // Keep user active
            setFirebaseLoading(false);
            setDataLoading(false);
          }
        } else {
        }
      }
      
      if (!isAuthInProgress || session) {
        setFirebaseLoading(false);
      }
    });

    const handleWindowFocus = () => {
      if ((window as any).__studentos_file_picker_active__) {
        setTimeout(() => {
          (window as any).__studentos_file_picker_active__ = false;
        }, 1200);
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      window.removeEventListener('message', handleAuthMessage);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const STARTUP_MESSAGES = [
    "Verifying institutional identity & security clearance...",
    "Initializing Orion Neural AI & multi-persona tutors...",
    "Synchronizing Supabase realtime channels & push matrix...",
    "Mounting Scholar Workspace, SM-2 Flashcards & XP Arena..."
  ];

  // Smooth, non-blocking progress & telemetry state machine for Startup Screen
  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem('s_os_startup_shown') === 'true';
    } catch (_) {}

    if (alreadyShown && !firebaseLoading && !dataLoading) {
      setShowStartup(false);
      return;
    }

    setShowStartup(true);

    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        const isStillLoadingBackend = firebaseLoading || dataLoading;

        // While backend auth/data is still resolving, advance smoothly up to 78% so it never freezes at 0%
        if (isStillLoadingBackend) {
          const increment = prev < 35 ? 3 : prev < 60 ? 2 : prev < 78 ? 1 : 0;
          const next = Math.min(prev + increment, 78);
          setLoadingStep(next < 25 ? 0 : next < 50 ? 1 : next < 75 ? 2 : 3);
          return next;
        }

        // Once backend auth/data is ready, smoothly complete to 100%
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setShowStartup(false);
            try {
              sessionStorage.setItem('s_os_startup_shown', 'true');
            } catch (_) {}
          }, 450);
          return 100;
        }

        const stepSize = prev < 50 ? 6 : prev < 85 ? 5 : 4;
        const nextProgress = Math.min(prev + stepSize, 100);
        setLoadingStep(nextProgress < 25 ? 0 : nextProgress < 50 ? 1 : nextProgress < 75 ? 2 : 3);
        return nextProgress;
      });
    }, 55);

    return () => clearInterval(interval);
  }, [firebaseLoading, dataLoading]);

  const loadedRefs = useRef<{ [key: string]: boolean }>({});

  // Demo Mode Init
  useEffect(() => {
    if (!isDemoMode) return;
    setTasks([
      { id: 'task-1', title: 'AP Physics Vectors Review', completed: false, category: 'Physics', dueDate: 'Tomorrow', subject: 'Physics' },
      { id: 'task-2', title: 'Complete organic chemistry synthesis homework', completed: true, category: 'Chemistry', dueDate: 'Friday', subject: 'Chemistry' },
      { id: 'task-3', title: 'BST Balancing Algorithms practice', completed: false, category: 'Computer Science', dueDate: 'Next Monday', subject: 'Computer Science' }
    ]);
    setVaultNotes([
      { id: 'note-1', title: 'Lecture Notes - Centripetal Mechanics', content: 'Centripetal force is directed toward the center of curvature. The magnitude is F = m v^2 / r. No work is performed globally in circular orbits because force vector is perpendicular to motion displacement.', subject: 'Physics', createdAt: new Date().toLocaleDateString(), icon: '📝' },
      { id: 'note-2', title: 'Chemistry Synthesis notes', content: 'Lewis acid acts as an electron pair acceptor, while Lewis base is an electron pair donor. Important to understand pH vs pKa relations for synthetic organic derivatives.', subject: 'Chemistry', createdAt: new Date().toLocaleDateString(), icon: '🧪' }
    ]);
    setMaterials(INITIAL_MATERIALS);
    setFeedbackPosts(INITIAL_FEEDBACK);
    setAnnouncements(INITIAL_ANNOUNCEMENTS);
    setChats([
      { id: 'chat-1', name: 'Professor Elara', role: 'teacher', message: 'Welcome to the smart study group! Please feel free to ask formulas help.', createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 'chat-2', name: 'Naitik Kashyap', role: 'student', message: 'Thank you Professor! The formulas sheet has been super helpful.', createdAt: new Date(Date.now() - 1800000).toISOString() }
    ]);
    const demoThreadId = 'demo-thread-1';
    setAiThreads([
      {
        id: demoThreadId,
        title: 'Study with Professor Elara',
        personaId: 'elara',
        mode: 'explanatory',
        messages: [
          { role: 'assistant', content: "Hello Naitik! Welcome to your Study Session. I am Professor Elara, your AI Science & Engineering specialist. Choose a learning mode or ask a question to begin our deep-dive exploration!" }
        ],
        attachedFile: null,
        attachedFiles: []
      }
    ]);
    setActiveThreadId(demoThreadId);
    setHomeworkList([
      { id: 'hw-1', title: 'Physics Worksheets Chapter 4', subject: 'Physics', content: 'Solve problems 1-15 regarding circular friction.', dueDate: 'Tomorrow', classGrade: 'Grade 10', classSection: 'All Sections', givenBy: 'Prof. Elara', createdAt: new Date().toISOString(), completedList: [] },
      { id: 'hw-2', title: 'C++ BST balancing questions', subject: 'Computer Science', content: 'Design pseudo-code for rotation of tree node structures.', dueDate: 'Friday', classGrade: 'Grade 10', classSection: 'All Sections', givenBy: 'Prof. Elara', createdAt: new Date().toISOString(), completedList: ['naitik.kashyap0015@gmail.com'] }
    ]);
    setSchedules(MOCK_SCHEDULES);
    setDataLoading(false);
  }, [isDemoMode]);

  // Load Schedules
  useEffect(() => {
    if (!currentUser) {
      setSchedules([]);
      return;
    }
    const fallbackProfile = getDefaultProfileForAccount(currentUser.uid, currentUser.email);
    const userSchedules = currentUser.raw_data?.schedules || fallbackProfile?.raw_data?.schedules || [];
    setSchedules(userSchedules);
  }, [currentUser?.uid, currentUser?.email]);

  // Saved Material Bookmarks Sync per User
  useEffect(() => {
    if (!currentUser) {
      setSavedMaterialIds([]);
      return;
    }
    const uid = currentUser.uid || currentUser.email || 'guest';
    try {
      const localSaved = localStorage.getItem(`s_os_saved_materials_${uid}`);
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (Array.isArray(parsed)) {
          setSavedMaterialIds(parsed);
          return;
        }
      }
    } catch (_) {}
    const fallbackProfile = getDefaultProfileForAccount(currentUser.uid, currentUser.email);
    const initialSaved = currentUser.raw_data?.savedMaterialIds || fallbackProfile?.raw_data?.savedMaterialIds || [];
    setSavedMaterialIds(initialSaved);
  }, [currentUser?.uid, currentUser?.email]);

  // System Diagnostics Logging (CHAT_INIT, ROOMS_INIT, CURRENT_USER, CURRENT_ROLE)
  useEffect(() => {
    if (currentUser) {
      console.log("CURRENT_USER", currentUser);
      console.log("CURRENT_ROLE", currentUser.role || 'Unknown');
    }
  }, [currentUser?.uid]);

  const hasLoggedPeerChatRef = useRef(false);
  useEffect(() => {
    if (activeTab === 'peer_chat' && !hasLoggedPeerChatRef.current) {
      hasLoggedPeerChatRef.current = true;
      console.log("CHAT_INIT", { chatsCount: chats.length });
      console.log("ROOMS_INIT", chatRooms);
    } else if (activeTab !== 'peer_chat') {
      hasLoggedPeerChatRef.current = false;
    }
  }, [activeTab]);

  // Tasks Sync (Improved for Personal Tasks table)
  useEffect(() => {
    if (!currentUser?.uid) {
      setTasks([]);
      return;
    }
    
    let active = true;
    const syncTasks = async () => {
      try {
        const fetched = await getPersonalTasks(currentUser.uid!);
        if (active) {
          // If no tasks in DB, check raw_data for migration
          if (fetched.length === 0) {
            const rd = currentUser.raw_data || {};
            const userTasks = (rd.tasks || []) as Task[];
            if (userTasks.length > 0) {
              setTasks(userTasks);
              // Migrate to new table
              for (const t of userTasks) {
                await savePersonalTask(t, currentUser.uid!);
              }
            }
          } else {
            setTasks(fetched);
          }
        }
      } catch (err) {
        console.error('[Sync] Tasks fetch error:', err);
      }
    };

    syncTasks();
    return () => { active = false; };
  }, [currentUser?.uid]);

  // Personal Notes Sync (Staggered to prevent connection flood)
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      const loadNotes = async () => {
        try {
          const uid = currentUser.uid || currentUser.email || 'guest';
          const [dbNotes, fetchedFolders, fetchedMaterialFolders] = await Promise.all([
            getVaultNotes(uid),
            getFolders(uid, 'notes'),
            getFolders(uid, 'materials')
          ]);
          setVaultNotes(dbNotes);
          setVaultFolders(fetchedFolders);
          setMaterialFolders(fetchedMaterialFolders);
          if (!selectedNoteId) {
            setSelectedNoteId(dbNotes[0]?.id || null);
          }
        } catch (err) {
          console.error('[Sync] Failed to parse notes:', err);
          setVaultNotes([]);
        }
      };
      loadNotes();
    }, 250);

    return () => clearTimeout(timer);
  }, [currentUser?.uid, currentUser?.email]);

  // Homework Persistence Sync (Staggered)
  const isHomeworkLoaded = useRef<boolean>(false);

  useEffect(() => {
    if (!currentUser) {
      isHomeworkLoaded.current = false;
      return;
    }
    const timer = setTimeout(() => {
      getSupabaseHomework().then(list => {
        if (list && list.length > 0) {
          setHomeworkList(list);
        } else {
          // Fallback to default class homework on initial session
          setHomeworkList([
            { id: 'hw-1', title: 'Physics Worksheets Chapter 4', subject: 'Physics', content: 'Solve problems 1-15 regarding circular friction.', dueDate: 'Tomorrow', classGrade: 'Grade 10', classSection: 'All Sections', givenBy: 'Prof. Elara', createdAt: new Date().toISOString(), completedList: [] },
            { id: 'hw-2', title: 'C++ BST balancing questions', subject: 'Computer Science', content: 'Design pseudo-code for rotation of tree node structures.', dueDate: 'Friday', classGrade: 'Grade 10', classSection: 'All Sections', givenBy: 'Prof. Elara', createdAt: new Date().toISOString(), completedList: ['naitik.kashyap0015@gmail.com'] }
          ]);
        }
        isHomeworkLoaded.current = true;
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [currentUser]);

  // Realtime Supabase & Local Custom Event Sync for Orion Automations & Global Broadcasts
  useEffect(() => {
    if (!currentUser) return;

    const refreshNotifications = async () => {
      try {
        const list = await getAppNotifications(currentUser.uid, currentUser.grade, currentUser.section, effectiveRole);
        if (list) {
          setNotifications(prev => {
            if (list.length === 0 && prev.length > 0) return prev;
            return list;
          });
        }
        // Intelligent learning reminders check
        ReminderService.checkAndDispatchLearningReminders(currentUser.uid, currentUser.name).catch(() => {});
      } catch (e) {
        console.warn('[App] Error refreshing notifications:', e);
      }
    };

    refreshNotifications();

    const handleDbUpdate = (e: any) => {
      const { table } = e.detail || {};
      if (table === 'homework' || !table) {
        getSupabaseHomework().then(list => {
          if (list && list.length > 0) setHomeworkList(list);
        });
      }
      if (table === 'notifications' || table === 'notices' || !table) {
        refreshNotifications();
      }
    };

    const handleNotifStateChange = () => {
      refreshNotifications();
    };

    window.addEventListener('studentos-db-update', handleDbUpdate);
    window.addEventListener('studentos-notif-state-change', handleNotifStateChange);

    // Subscribe to both Postgres changes and Realtime Broadcast channel safely
    let channel: any = null;
    try {
      supabase.getChannels().forEach(ch => {
        if (ch.topic === 'realtime:student-os-live-sync') {
          supabase.removeChannel(ch);
        }
      });
      channel = supabase.channel('student-os-live-sync')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
          refreshNotifications();
          const row = payload?.new as any;
          if (row && currentUser && isUserEligibleForNotification(row, currentUser)) {
            const nId = row.id || '';
            triggerBrowserPushNotification(row.title || '📢 Veylentra Notice', {
              body: row.message || row.content || '',
              tag: nId ? `studentos-notif-${nId}` : `studentos-notif-${Date.now()}`,
              notifId: nId,
              linkTab: row.link_tab || row.payload?.linkTab || 'notice_viewer'
            });
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, () => {
          refreshNotifications();
        })
        .on('broadcast', { event: 'new_app_notification' }, (payload) => {
          console.log('[REALTIME-BROADCAST] Received broadcast notification:', payload);
          refreshNotifications();
          const notif = payload?.payload;
          if (notif && currentUser && isUserEligibleForNotification(notif, currentUser)) {
            triggerNotificationSound(notif.type || 'announcement');
            triggerBrowserPushNotification(notif.title || '📢 Veylentra Notice', {
              body: notif.message || '',
              tag: notif.id ? `studentos-notif-${notif.id}` : `studentos-notif-${Date.now()}`,
              notifId: notif.id,
              linkTab: notif.linkTab || 'notice_viewer'
            });
          }
        })
        .subscribe();
    } catch (err) {
      console.warn('[Realtime] student-os-live-sync channel setup notice:', err);
    }

    return () => {
      window.removeEventListener('studentos-db-update', handleDbUpdate);
      window.removeEventListener('studentos-notif-state-change', handleNotifStateChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUser?.uid, currentUser?.grade, currentUser?.section, effectiveRole]);

  // We don't save the entire list to localStorage anymore in an effect, 
  // because each action (add, complete, delete) will call saveSupabaseHomework individually.

  // AI Buddy Chats Sync — loads when user is authenticated (staggered delay to prevent connection flood)
  useEffect(() => {
    if (!currentUser) {
      aiChatsSyncingFor.current = null;
      return;
    }
    // Use Firebase auth UID consistently (same as what saveAiBuddyChat uses)
    const uid = currentUser?.uid || currentUser.uid;
    if (!uid) return;
    
    // Prevent parallel/duplicate syncing for the same user ID
    if (aiChatsSyncingFor.current === uid) return;
    aiChatsSyncingFor.current = uid;
    
    const timer = setTimeout(() => {
      console.log("[SUPABASE-CHAT] Syncing aiBuddyChats for user:", uid);
      
      getAiBuddyChats(uid).then((list) => {
        if (list && list.length > 0) {
          const uniqueList = Array.from(new Map(list.map(t => [t.id, t])).values());
          const sortedList = uniqueList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) as any;
          setAiThreads(sortedList);
          setActiveThreadId(prev => {
            if (!prev || !uniqueList.find(t => t.id === prev)) {
              const hasUserDefault = uniqueList.find(t => t.title === 'Introductory Study Unit');
              return hasUserDefault ? hasUserDefault.id : (uniqueList[0]?.id || prev);
            }
            return prev;
          });
        } else {
          const userDefaultId = crypto.randomUUID();
          const defaultT = {
            id: userDefaultId,
            title: 'Introductory Study Unit',
            personaId: 'study_buddy',
            mode: 'explanatory' as const,
            messages: [
              { role: 'assistant' as const, content: `Hey! 🚀 Welcome to your Campus AI workspace. Here is what you can do:

- **Start New Chat Threads**: Manage different lesson conversations seamlessly.
- **Toggle Dynamic Learning Modes**: Socratic guidance, deeper explanations, code coach reviews, and exam challenges.
- **Analyze Uploaded Files**: Drag and drop or browse standard codes, notes, chemistry formulae, or texts here to direct our context!

What can I clarify today?` }
            ],
            attachedFile: null,
            attachedFiles: [],
            userId: uid,
            createdAt: Date.now()
          };
          saveAiBuddyChat(defaultT).then(() => {
            setAiThreads([defaultT]);
            setActiveThreadId(userDefaultId);
          });
        }
      }).catch(error => {
        console.error("[SUPABASE-CHAT] Error loading AI buddy chats:", error);
        aiChatsSyncingFor.current = null; // Allow retry on failure
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [currentUser]); // Load when user logs in — not gated on tab so chats survive refresh

  // Educational Materials Hub Sync — loads for all tabs and re-syncs on user switch
  useEffect(() => {
    if (!currentUser) return;
    console.log("[SUPABASE] Fetching materials for user:", currentUser.uid);
    getSupabaseMaterials().then(list => {
      setMaterials(list);
    }).catch(err => {
      console.error('Failed to load materials from Supabase:', err);
    });
  }, [currentUser?.uid, activeTab === 'materials']);

  // Feedback Sync
  useEffect(() => {
    if (!currentUser || activeTab !== 'feedback') return;
    const loadFeedbacks = async () => {
      try {
        const { data, error } = await supabase.from('global_data').select('*').eq('id', '__global_feedbacks__').maybeSingle();
        if (data && data.content) {
          setFeedbackPosts(JSON.parse(data.content));
        } else {
          setFeedbackPosts(INITIAL_FEEDBACK);
        }
      } catch (e) {
        setFeedbackPosts(INITIAL_FEEDBACK);
      }
    };
    loadFeedbacks();
  }, [currentUser, activeTab]);

  // Announcements Sync
  useEffect(() => {
    if (!currentUser || activeTab !== 'dashboard') return;
    const loadAnnouncements = async () => {
      try {
        const { data } = await supabase.from('global_data').select('*').eq('id', '__global_announcements__').maybeSingle();
        if (data && data.content) {
          setAnnouncements(JSON.parse(data.content));
        } else {
          setAnnouncements(INITIAL_ANNOUNCEMENTS);
        }
      } catch (e) {
        setAnnouncements(INITIAL_ANNOUNCEMENTS);
      }
    };
    loadAnnouncements();
  }, [currentUser, activeTab]);

  // Chats & Rooms Sync On-Demand (Loaded from Supabase)
  useEffect(() => {
    if (!currentUser) return;
    console.log("[SUPABASE-CHAT] Fetching peer messages & chat rooms from Supabase...");
    getPeerMessages().then(list => {
      if (list) {
        setChats(list);
      }
    }).catch(err => {
      console.error("[SUPABASE-CHAT] Error fetching peer messages:", err);
    });

    getChatRooms(currentUser.uid).then(roomsList => {
      if (roomsList) {
        setChatRooms(roomsList);
      }
    }).catch(err => {
      console.error("[SUPABASE-CHAT] Error fetching chat rooms:", err);
    });
  }, [currentUser?.uid]);



  // --- Supabase Realtime Sync Client ---
  useEffect(() => {
    console.log('[Realtime] Establishing Supabase channel...');
    
    // Clean up any pre-existing 'student-os-public' channel so adding postgres_changes never collides with an already-subscribed singleton
    try {
      supabase.getChannels().forEach(ch => {
        if (ch.topic === 'realtime:student-os-public') {
          supabase.removeChannel(ch);
        }
      });
    } catch (_) {}

    const channel = supabase.channel('student-os-public');

    // Setup socketRef mock for the rest of the app to seamlessly use Supabase broadcast
    socketRef.current = {
      readyState: 1, // WebSocket.OPEN
      send: (msgString: string) => {
        try {
          const payload = JSON.parse(msgString);
          channel.send({
            type: 'broadcast',
            event: 'ws_message',
            payload: payload
          });
        } catch (e) {
          console.error("Failed to parse and send broadcast:", e);
        }
      }
    };

    try {
      channel.on('broadcast', { event: 'principal_live_broadcast' }, (payload) => {
        if (payload?.payload && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('studentos-live-broadcast', { detail: payload.payload }));
        }
      });

    channel.on('broadcast', { event: 'ws_message' }, (payload) => {
      try {
        const data = payload.payload;
        if (!data) return;
        
        switch (data.type) {
          case 'chat:send':
            setChats(prev => {
              if (prev.some(c => c.id === data.chat.id)) return prev;
              return [...prev, data.chat];
            });
            setTimeout(() => {
              const view = document.getElementById('chat-scroll-view');
              if (view) view.scrollTop = view.scrollHeight;
            }, 40);
            break;

          case 'announcement:received':
            setAnnouncements(prev => {
              if (prev.some(a => a.id === data.announcement.id)) return prev;
              return [data.announcement, ...prev];
            });
            showNotification(`📢 NEW ANNOUNCEMENT: ${data.announcement.title}`);
            break;

          case 'homework:received':
            setHomeworkList(prev => {
              if (prev.some(h => h.id === data.homework.id)) return prev;
              return [data.homework, ...prev];
            });
            showNotification(`📝 New Homework Released: ${data.homework.title}`);
            break;

          case 'homework:updated':
            setHomeworkList(prev => prev.map(h => h.id === data.homework.id ? data.homework : h));
            break;

          case 'whiteboard:draw':
          case 'whiteboard:drawShape':
          case 'whiteboard:drawing':
            receiveRemoteWhiteboardDraw(data.data);
            break;

          case 'whiteboard:clear':
          case 'whiteboard:cleared':
            clearLocalCanvas();
            break;
            
          case 'feedbacks:updated':
            if (data.payload?.feedbacks) {
              setFeedbackPosts(data.payload.feedbacks);
            }
            break;
        }
      } catch (err) {
        console.error('[Realtime] message process failure', err);
      }
    });

    // Realtime Broadcast Event: New Chat Message
    channel.on('broadcast', { event: 'new_chat_message' }, (payload) => {
      if (payload.payload) {
        const newMsg = payload.payload as ChatMessage;
        setChats(prev => {
          const idx = prev.findIndex(m => m.id === newMsg.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...newMsg };
            return updated;
          }
          return [...prev, newMsg];
        });
        setTimeout(() => {
          const view = document.getElementById('chat-scroll-view');
          if (view) view.scrollTop = view.scrollHeight;
        }, 40);
      }
    });

    // Realtime Broadcast Event: Room Updated
    channel.on('broadcast', { event: 'room_updated' }, (payload) => {
      const uid = currentUserRef.current?.uid;
      getChatRooms(uid).then(rooms => {
        if (rooms) setChatRooms(rooms);
      }).catch(console.error);
    });

    // Realtime Broadcast Event: Room Left
    channel.on('broadcast', { event: 'room_left' }, () => {
      const uid = currentUserRef.current?.uid;
      getChatRooms(uid).then(rooms => {
        if (rooms) setChatRooms(rooms);
      }).catch(console.error);
    });

    // Realtime Broadcast Event: Room Deleted
    channel.on('broadcast', { event: 'room_deleted' }, (payload) => {
      if (payload.payload?.roomId) {
        const delId = payload.payload.roomId;
        setChatRooms(prev => prev.filter(r => r.id !== delId));
        setActiveChatTargetId(prev => prev === delId ? 'group-all' : prev);
      }
    });

    // Realtime Postgres Changes: Chat Room Messages
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_room_messages' }, () => {
      getPeerMessages().then(list => {
        if (list) setChats(list);
      }).catch(console.error);
    });

    // Realtime Postgres Changes: Messages (legacy table support)
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      getPeerMessages().then(list => {
        if (list) setChats(list);
      }).catch(console.error);
    });

    // Realtime Postgres Changes: Chat Rooms
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
      const uid = currentUserRef.current?.uid;
      getChatRooms(uid).then(rooms => {
        if (rooms) setChatRooms(rooms);
      }).catch(console.error);
    });

    // Realtime Postgres Changes: Room Members
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_room_members' }, () => {
      const uid = currentUserRef.current?.uid;
      getChatRooms(uid).then(rooms => {
        if (rooms) setChatRooms(rooms);
      }).catch(console.error);
    });

    // Realtime Postgres Changes: AI Buddy Chats
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'ai_buddy_chats' }, (payload) => {
      const uid = currentUserRef.current?.uid;
      if (!uid) return;
      if (payload.eventType === 'DELETE') {
        if (payload.old?.id) {
          setAiThreads(prev => prev.filter(t => t.id !== payload.old.id));
        }
      } else if (payload.new && payload.new.user_id === uid) {
        getAiBuddyChats(uid).then(threads => {
          if (threads && threads.length > 0) {
            setAiThreads(prev => {
              const map = new Map(prev.map(t => [t.id, t]));
              for (const remote of threads as any[]) {
                const local: any = map.get(remote.id);
                if (!local || remote.messages.length >= local.messages.length) {
                  map.set(remote.id, remote);
                }
              }
              return Array.from(map.values()).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
            });
          }
        }).catch(console.error);
      }
    });

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Connected successfully to Supabase!');
        }
      });
    } catch (realtimeErr) {
      console.warn('[Realtime] Channel listener registration warning:', realtimeErr);
    }

    return () => {
      supabase.removeChannel(channel);
      socketRef.current = null;
    };
  }, []);



  // Whiteboard drawing synchronization helpers
  const receiveRemoteWhiteboardDraw = (data: any) => {
    const canvas = whiteboardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = data.tool === 'eraser' ? '#0f172a' : data.color || '#6366f1';
    ctx.lineWidth = data.tool === 'eraser' ? data.size * 4 : data.size || 4;

    if (data.type === 'draw') {
      ctx.beginPath();
      ctx.moveTo(data.x1, data.y1);
      ctx.lineTo(data.x2, data.y2);
      ctx.stroke();
    } else if (data.type === 'shape:circle') {
      ctx.beginPath();
      ctx.arc(data.x, data.y, data.radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (data.type === 'shape:rect') {
      ctx.beginPath();
      ctx.strokeRect(data.x, data.y, data.w, data.h);
    }
    ctx.restore();
  };

  const clearLocalCanvas = () => {
    const canvas = whiteboardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // --- Notion-style NVIDIA AI Notes transform helper ---
  const handleAINoteAction = async (action: string) => {
    const activeNote = vaultNotes.find(n => n.id === selectedNoteId);
    if (!activeNote) return;

    setAiGeneratingNotes(true);
    let promptText = activeNote.content;
    
    const textarea = document.getElementById('notion-editor-textarea') as HTMLTextAreaElement;
    let selectedTextLength = 0;
    let startSel = 0;
    let endSel = 0;

    if (textarea) {
      startSel = textarea.selectionStart;
      endSel = textarea.selectionEnd;
      const selected = textarea.value.substring(startSel, endSel);
      if (selected.trim().length > 5) {
        promptText = selected;
        selectedTextLength = selected.length;
        showNotification('🤖 AI Companion processing highlighted block segment...');
      }
    }

    try {
      let resultText = '';
      try {
        const response = await fetch('/api/ai/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: promptText,
            action,
            instruction: action === 'custom' ? aiCustomPrompt : undefined
          })
        });
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || `HTTP ${response.status}`);
        }

        const resData = await response.json();
        if (resData.error) {
          throw new Error(resData.error);
        }
        resultText = resData.text;
      } catch (err: any) {
        console.error("Notes AI transform error:", err?.message || err);
        showNotification('AI is temporarily unavailable. Please try again.');
        return;
      }

      if (resultText) {
        if (selectedTextLength > 0) {
          const before = activeNote.content.substring(0, startSel);
          const after = activeNote.content.substring(endSel);
          const updatedContent = before + `

${resultText}

` + after;
          setVaultNotes(prev => {
            const newNotes = prev.map(n => n.id === activeNote.id ? { ...n, content: updatedContent } : n);
            if (currentUser) (async () => {
       const newArr = newNotes;
       for (const n of newArr) {
          saveVaultNoteToSupabase(n).catch(()=>{});
       }
     })();
            return newNotes;
          });
        } else {
          const updatedContent = action === 'summarize' || action === 'improve'
            ? resultText 
            : activeNote.content + `

---

### 🤖 AI Expansion:
` + resultText;
          setVaultNotes(prev => {
            const newNotes = prev.map(n => n.id === activeNote.id ? { ...n, content: updatedContent } : n);
            if (currentUser) (async () => {
       const newArr = newNotes;
       for (const n of newArr) {
          saveVaultNoteToSupabase(n).catch(()=>{});
       }
     })();
            return newNotes;
          });
        }
        showNotification('⚡ Notion block written successfully with NVIDIA AI!');
        if (action === 'custom') setAiCustomPrompt('');
      }
    } catch (err: any) {
      console.error(err);
      showNotification(`Could not establish connection with AI: ${err.message}`);
    } finally {
      setAiGeneratingNotes(false);
    }
  };




  // Sync house stats simulation
  const addHousePoints = (houseName: HouseType, amt: number) => {
    setHousePoints(prev => {
      const next = { ...prev, [houseName]: prev[houseName] + amt };
      showNotification(`House ${houseName} earned +${amt} points!`);
      return next;
    });
  };

  // Auth Operations
  const handleMockLogin = (role: 'student' | 'teacher' | 'admin' | 'coordinator' | 'super_admin') => {
    let mockProfile: UserProfile = {
      uid: `mock-${role}-12345`,
      email: `mock_${role}@school.edu`,
      name: `Mock ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      role: role as any,
    };
    if (role === 'student') {
      mockProfile.grade = 'Grade 10';
      mockProfile.section = 'Solara';
      mockProfile.house = 'Emerald';
    }
    if (role === 'teacher') {
      mockProfile.assignedGrades = ['Grade 10', 'Grade 12'];
      mockProfile.assignedSections = ['Solara', 'Astra'];
      mockProfile.assignedClasses = ['10_Solara', '12_Astra'];
    }
    showNotification(`Dropping into Dev Mode as ${role}`);
    setCurrentUser(mockProfile);
    localStorage.setItem('s_os_user', JSON.stringify(mockProfile));
    saveSupabaseUserProfile(mockProfile).catch(console.error);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      showNotification('Please provide email and password');
      return;
    }
    
    try {
      setAuthError(null);
      setFirebaseLoading(true);

      let authenticated = false;
      let authUser: any = null;

      // 1. First attempt Supabase Auth sign-in
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail.trim(),
          password: loginPassword,
        });

        if (!error && data?.user) {
          authenticated = true;
          authUser = data.user;
        }
      } catch (authErr) {
        console.warn('Supabase Auth signIn failed, attempting fallback:', authErr);
      }

      // 2. If Supabase Auth failed, attempt signUp to establish session or verify via backend
      if (!authenticated) {
        try {
          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: loginEmail.trim(),
            password: loginPassword,
          });
          if (!signUpErr && signUpData?.user && signUpData?.session) {
            authenticated = true;
            authUser = signUpData.user;
          }
        } catch (_) {}
      }

      // 3. Fallback to server endpoint if needed
      if (!authenticated) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword })
        });
        const resData = await res.json();
        if (res.ok && resData.success && resData.profile) {
          authenticated = true;
          const userProfile = resData.profile;
          setCurrentUser(userProfile);
          try {
            localStorage.setItem('s_os_user', JSON.stringify(userProfile));
          } catch (_) {}
          updateRecentAccounts(userProfile);
          try {
            sessionStorage.removeItem('s_os_startup_shown');
          } catch (_) {}
          setShowStartup(true);
          setFirebaseLoading(false);
          showNotification(`Welcome back, ${userProfile.name}! ✅`);
          return;
        } else {
          throw new Error(resData.error || 'Invalid credentials or incorrect password.');
        }
      }

      if (authUser) {
        let profile = await getSupabaseUserProfile(authUser.id, authUser.email);
        if (!profile) {
          profile = {
            uid: authUser.id,
            name: authUser.user_metadata?.full_name || loginEmail.split('@')[0] || 'Student',
            email: authUser.email || loginEmail.trim(),
            role: 'student',
            accountStatus: 'approved',
            studyHours: 0,
            quizzesTaken: 0,
            streakDays: 0,
            lastLogin: Date.now()
          };
          await saveSupabaseUserProfile(profile);
        }
        setCurrentUser(profile);
        localStorage.setItem('s_os_user', JSON.stringify(profile));
        updateRecentAccounts(profile);
      }

      try {
        sessionStorage.removeItem('s_os_startup_shown');
      } catch (_) {}
      setShowStartup(true);
      setFirebaseLoading(false);
      showNotification('Login successful!');
    } catch (err: any) {
      console.error('Email login error:', err);
      setAuthError({
        code: err.code || 'login-error',
        message: err.message || 'Login failed',
        hostname: window.location.hostname
      });
      showNotification(`Login failed: ${err.message}`);
      setFirebaseLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      if (data?.url) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open(
          data.url,
          'supabase-google-signin',
          `width=${width},height=${height},left=${left},top=${top}`
        );
        if (!popup) {
          showNotification('⚠️ Popup blocked. Please allow popups for this site.');
        } else {
          showNotification('🔑 Sign-In popup opened. Please complete Google authentication.');
        }
      }
    } catch (error: any) {
      console.error('[Auth] Google Sign-In failed:', error);
      const code = error?.code || 'unknown';
      const msg = error?.message || String(error);
      setAuthError({
        code,
        message: msg,
        hostname: window.location.hostname
      });
      showNotification(`❌ Sign-In Failed: [${code}] ${msg}`);
    }
  };

  const handleGoogleSignInWithSelect = async () => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            prompt: 'select_account'
          },
          redirectTo: window.location.origin,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      if (data?.url) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open(
          data.url,
          'supabase-google-signin',
          `width=${width},height=${height},left=${left},top=${top}`
        );
        if (!popup) {
          showNotification('⚠️ Popup blocked. Please allow popups for this site.');
        } else {
          showNotification('🔑 Sign-In popup opened. Please choose your Google account.');
        }
      }
    } catch (error: any) {
      console.error('[Auth] Google Sign-In with select_account failed:', error);
      const code = error?.code || 'unknown';
      const msg = error?.message || String(error);
      setAuthError({
        code,
        message: msg,
        hostname: window.location.hostname
      });
      showNotification(`❌ Sign-In Failed: [${code}] ${msg}`);
    }
  };

  const updateRecentAccounts = (profile: UserProfile) => {
    if (!profile || !profile.uid) return;
    const newAcc: RecentAccount = {
      uid: profile.uid,
      name: profile.name || 'Anonymous',
      email: profile.email || '',
      photoURL: profile.photoURL || profile.avatar || '',
      role: profile.role || 'student',
      lastLogin: Date.now()
    };
    setRecentAccounts(prev => {
      const filtered = prev.filter(a => a.email !== profile.email && a.uid !== profile.uid);
      const updated = [newAcc, ...filtered].slice(0, 5);
      localStorage.setItem('s_os_recent_accounts', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLinkGoogle = async () => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      if (data?.url) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open(
          data.url,
          'supabase-google-signin',
          `width=${width},height=${height},left=${left},top=${top}`
        );
        if (!popup) {
          showNotification('⚠️ Popup blocked. Please allow popups for this site.');
        } else {
          showNotification('🔑 Account-linking popup opened.');
        }
      }
    } catch (error: any) {
      console.error('[Auth] Link Google failed:', error);
      const code = error?.code || 'unknown';
      const msg = error?.message || String(error);
      setAuthError({
        code,
        message: msg,
        hostname: window.location.hostname
      });
      showNotification(`❌ Account linking failed: [${code}] ${msg}`);
    }
  };

  const handleContinueRecentAccount = async (acc: RecentAccount) => {
    if (acc.uid && acc.uid.startsWith('manual-')) {
      if (acc.role === 'admin' || acc.role === 'coordinator' || acc.role === 'super_admin') {
        setSecurityVerificationAcc(acc);
        setEnteredVerificationPin('');
        setPinVerificationError('');
        setIsPinModalOpen(true);
      } else {
        try {
          let profile: UserProfile | null = null;
          try {
            profile = await getSupabaseUserProfile(acc.uid);
          } catch (sbErr) {
            console.error('[Supabase] Failed to load recent account from Supabase:', sbErr);
          }

          if (profile) {
            setCurrentUser(profile);
            localStorage.setItem('s_os_user', JSON.stringify(profile));
            showNotification(`Authenticated successfully as ${profile.name}!`);
          } else {
            showNotification('Profile not found in Supabase database.');
          }
        } catch (e) {
          console.error(e);
          showNotification('Error loading manual profile.');
        }
      }
    } else {
      if (acc.role === 'admin' || acc.role === 'coordinator' || acc.role === 'super_admin') {
        setSecurityVerificationAcc(acc);
        setEnteredVerificationPin('');
        setPinVerificationError('');
        setIsPinModalOpen(true);
      } else {
        await performGoogleAuthForRecentAccount(acc);
      }
    }
  };

  const performGoogleAuthForRecentAccount = async (acc: RecentAccount) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            login_hint: acc.email
          },
          redirectTo: window.location.origin,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      if (data?.url) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open(
          data.url,
          'supabase-google-signin',
          `width=${width},height=${height},left=${left},top=${top}`
        );
        if (!popup) {
          showNotification('⚠️ Popup blocked. Please allow popups for this site.');
        } else {
          showNotification(`🔑 Sign-In popup opened for ${acc.name}.`);
        }
      }
    } catch (error: any) {
      console.error('[Auth] Recent account Google sign-in failed:', error);
      const code = error?.code || 'unknown';
      const msg = error?.message || String(error);
      setAuthError({
        code,
        message: msg,
        hostname: window.location.hostname
      });
      showNotification(`❌ Authentication Failed: [${code}] ${msg}`);
    }
  };

  const handleVerifyPinAndLogin = async () => {
    if (!securityVerificationAcc) return;
    try {
      let profile: UserProfile | null = null;
      try {
        profile = await getSupabaseUserProfile(securityVerificationAcc.uid);
      } catch (sbErr) {
        console.error('[Supabase] Failed to check PIN from Supabase:', sbErr);
      }

      if (profile) {
        const expectedPin = profile.pin || (import.meta as any).env.VITE_ADMIN_PIN || '1234';
        if (enteredVerificationPin === expectedPin) {
          setIsPinModalOpen(false);
          setPinVerificationError('');
          showNotification('PIN verified. Terminating verification gate...');
          if (securityVerificationAcc.uid && securityVerificationAcc.uid.startsWith('manual-')) {
            setCurrentUser(profile);
            localStorage.setItem('s_os_user', JSON.stringify(profile));
            showNotification(`Welcome back, ${profile.name}!`);
          } else {
            await performGoogleAuthForRecentAccount(securityVerificationAcc);
          }
        } else {
          setPinVerificationError('Incorrect 4-digit PIN. Please try again.');
        }
      } else {
        setPinVerificationError('Account record not found.');
      }
    } catch (err) {
      console.error(err);
      setPinVerificationError('Error validating PIN with security node.');
    }
  };

  const handleRemoveRecentAccount = (email: string) => {
    setRecentAccounts(prev => {
      const updated = prev.filter(a => a.email !== email);
      localStorage.setItem('s_os_recent_accounts', JSON.stringify(updated));
      return updated;
    });
    showNotification('Account reference removed from device list.');
  };

  const hashPassword = async (password: string): Promise<string> => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.error('SubtleCrypto failure, using fallback hash:', e);
      let hash = 0;
      for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return `fb-${Math.abs(hash).toString(16)}`;
    }
  };

  const handleOnboardingLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!regName.trim()) {
      showNotification('Please provide a valid name tag.');
      return;
    }
    
    // NEW: Full name validation (only letters and spaces)
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(regName.trim()) || regName.trim().length < 2) {
      showNotification('Full name must contain only letters and spaces (min 2 characters).');
      return;
    }

    if (!regPhone.trim() || !/^[+0-9\-\s()]+$/.test(regPhone.trim())) {
      showNotification('Please provide a valid phone number.');
      return;
    }
    if (!regBirthdate) {
      showNotification('Please provide a valid birthdate.');
      return;
    }
    
    const emailValidation = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regEmail.trim() || !emailValidation.test(regEmail.trim())) {
      showNotification('Please provide a valid email format.');
      return;
    }

    
    const finalEmail = regEmail.trim();

    // Sign up with Supabase Auth if not linked via Google
    let actualUid = linkedGoogleUid;
    let passwordHash = '';
    let authData: any = null;
    if (!isGoogleLinked) {
      if (!regPassword || regPassword.length < 6) {
         showNotification('Please provide a password of at least 6 characters.');
         return;
      }
      
      passwordHash = await hashPassword(regPassword);

      const { data, error: authError } = await supabase.auth.signUp({
        email: finalEmail,
        password: regPassword,
        options: {
          data: {
            full_name: regName.trim(),
          }
        }
      });
      
      if (authError) {
        console.error('Supabase Auth Signup Error:', authError);
        showNotification(`Signup failed: ${authError.message}`);
        return;
      }
      
      authData = data;
      
      if (authData && authData.user) {
         setLinkedGoogleUid(authData.user.id);
         actualUid = authData.user.id;
         
         if (!authData.session) {
            // Email verification is required
            // Save their profile, but don't log them in automatically
            console.log('Email verification required');
         }
      }

    }

    const statusMap = {
      student: 'approved',
      teacher: 'pending_teacher',
      coordinator: 'pending_coordinator',
      admin: 'pending_admin'
    };

    const isWhitelisted = finalEmail && [
      'naitik.kashyap0015@gmail.com',
      'naitik.kashyap5205@gmail.com'
    ].includes(finalEmail.toLowerCase());

    const status = isWhitelisted ? 'approved' : (statusMap[regRole] || 'approved');
    // Using the auth user id if available, otherwise it will just use a fallback which shouldn't happen with real Auth
    const uid = actualUid || `manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newProfile: any = {
      uid: uid,
      name: regName.trim(),
      email: finalEmail,
      photoURL: regPhoto.trim() || linkedGooglePhoto || '',
      role: isWhitelisted ? 'super_admin' : 'student', // Everyone starts as student except whitelisted
      requestedRole: isWhitelisted ? 'admin' : regRole,
      accountStatus: status,
      phone: regPhone.trim(),
      birthdate: regBirthdate,
      studyHours: 8,
      quizzesTaken: 2,
      streakDays: 4,
      lastLogin: Date.now(),
      raw_data: {
        password_hash: passwordHash
      }
    };

    if (regRole === 'student') {
      newProfile.grade = regGrade;
      newProfile.section = regSection;
      newProfile.house = regHouse;
    } else if (regRole === 'teacher') {
      newProfile.specialtySubject = regSubjects.split(',')[0]?.trim() || 'General';
      newProfile.department = regDept.trim();
      newProfile.subjects = regSubjects.split(',').map(s => s.trim()).filter(Boolean);
      newProfile.pin = (import.meta as any).env.VITE_ADMIN_PIN || '1234';
    } else if (regRole === 'coordinator') {
      newProfile.specialtySubject = 'General';
      newProfile.department = regDept.trim();
      newProfile.pin = (import.meta as any).env.VITE_ADMIN_PIN || '1234';
    } else if (regRole === 'admin') {
      newProfile.specialtySubject = 'General';
      newProfile.designation = regDesignation.trim();
      newProfile.pin = (import.meta as any).env.VITE_ADMIN_PIN || '1234';
    }
    
    if (newProfile.role === 'super_admin') {
      newProfile.pin = (import.meta as any).env.VITE_ADMIN_PIN || '1234';
    }

    try {
      try {
        await saveSupabaseUserProfile(newProfile);
      } catch (sbErr) {
        console.error('[Supabase] Failed to save new registration to Supabase:', sbErr);
        throw sbErr;
      }
      
      
      if (!isGoogleLinked && authData && authData.user && !authData.session) {
        showNotification('Please check your email to verify your account. You can log in after verification.');
        setRegStep('login');
        return;
      }

      setCurrentUser(newProfile);
      updateRecentAccounts(newProfile);
      localStorage.setItem('s_os_user', JSON.stringify(newProfile));
      try {
        sessionStorage.removeItem('s_os_startup_shown');
      } catch (_) {}
      setShowStartup(true);
      
      if (regRole === 'student') {
        showNotification(`Welcome to Veylentra, ${newProfile.name}!`);
      } else {
        showNotification(`Request submitted for ${regRole.toUpperCase()} approval. Exploring as Student in the meantime!`);
      }

      
      setRegStep('login');
    } catch (error: any) {
      console.error('Failed to register user:', error);
      showNotification(`⚠️ Registration failed: ${error.message || String(error)}`);
    }
  };

  const handleLogout = async () => {
    try {
      (window as any).__studentos_explicit_logout__ = true;
      await supabase.auth.signOut();
      localStorage.removeItem('s_os_user');
      localStorage.removeItem('s_os_active_tab');
      try {
        sessionStorage.removeItem('s_os_startup_shown');
      } catch (_) {}
      setShowStartup(true);
      setCurrentUser(null);
      setStudentJoinedClass(false);
      
      // Reset business states
      setTasks([]);
      setVaultNotes([]);
      setMaterials([]);
      setFeedbackPosts([]);
      setAnnouncements([]);
      setChats([]);
      setAiThreads([]);
      setHomeworkList([]);
      setSchedules([]);
      setStudents([]);
      
      showNotification('Workspace session terminated.');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  // Tasks manager operations
  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !currentUser?.uid) return;
    soundService.playSuccess();
    const item: Task = {
      id: generateUniqueId(),
      title: newTaskTitle.trim(),
      completed: false,
      dueDate: 'Tomorrow',
      subject: currentUser?.specialtySubject || 'General',
      userId: currentUser.uid,
      createdAt: new Date().toISOString(),
      sort_order: tasks.length
    };
    
    const updated = [...tasks, item];
    setTasks(updated);
    setNewTaskTitle('');
    await savePersonalTask(item, currentUser.uid);
    showNotification('Task added to your personal list.');
  };

  const toggleTask = async (id: string) => {
    if (!currentUser?.uid) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!task.completed) {
      soundService.playTaskComplete();
    } else {
      soundService.playClick();
    }

    const updatedTask = { ...task, completed: !task.completed };
    const updated = tasks.map(t => t.id === id ? updatedTask : t);
    setTasks(updated);
    await savePersonalTask(updatedTask, currentUser.uid);
  };

  const deleteTask = async (id: string) => {
    if (!currentUser?.uid) return;
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    await deletePersonalTask(id);
    showNotification('Task removed.');
  };

  const handleReorderTasks = async (newOrder: Task[]) => {
    if (!currentUser?.uid) return;
    setTasks(newOrder);
    await saveTaskOrderToSupabase(newOrder, currentUser.uid);
  };

  // Vault Notes notes state
  const handleSaveNote = async () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim() || !currentUser) {
      showNotification('Please provide a title and transcript contents.');
      return;
    }
    const uid = currentUser.uid;
    const noteId = generateUniqueId();
    const note: VaultNote = {
      id: noteId,
      title: newNoteTitle.trim(),
      subject: newNoteSubject,
      content: newNoteContent.trim(),
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      userId: uid
    };
    try {
      const updated = [...vaultNotes, note];
      setVaultNotes(updated);
      (async () => {
       const newArr = updated;
       for (const n of newArr) {
          saveVaultNoteToSupabase(n).catch(()=>{});
       }
     })();
      setNewNoteTitle('');
      setNewNoteContent('');
      awardStudentXP(currentUser, 'create_note', { uniqueItemId: noteId });
      showNotification('Lecture notes secured.');
    } catch (err: any) {
      console.error('Error saving note:', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const nameRegex = /^[A-Za-z\s\-]+$/;
    const proposedName = profileNameInput.trim() || currentUser.name;
    if (!nameRegex.test(proposedName)) {
      showNotification('Full name must contain only letters, spaces, and hyphens.');
      return;
    }
    const updated: UserProfile = {
      ...currentUser,
      name: profileNameInput.trim() || currentUser.name,
      grade: profileGradeInput || currentUser.grade,
      section: profileSectionInput,
      house: profileHouseInput,
      avatar: profileAvatar,
      photoURL: profileAvatar
    };
    try {
      try {
        await saveSupabaseUserProfile(updated);
      } catch (sbErr) {
        console.error('[Supabase] Failed to save profile to Supabase:', sbErr);
        throw sbErr;
      }
      
      setCurrentUser(updated);
      try {
        sessionStorage.removeItem('s_os_startup_shown');
      } catch (_) {}
      setShowStartup(true);
      showNotification('Academic profile credentials synced successfully.');
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
  };

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schSubject.trim() || !schTime.trim()) {
      showNotification('Provide both a focus subject and a target window.');
      return;
    }
    const item: ScheduleItem = {
      id: generateUniqueId(),
      subject: schSubject.trim(),
      time: schTime.trim(),
      day: schDay
    };
    setSchedules(prev => [...prev, item]);
    setSchSubject('');
    setSchTime('');
    showNotification('Schedule Interval Added');
  };

  const handleDeleteSchedule = (id: string) => {
    setSchedules(prev => {
      const updated = prev.filter(item => item.id !== id);
      if (currentUser) {
        const updatedUser = { ...currentUser, raw_data: { ...(currentUser.raw_data || {}), schedules: updated } };
        setCurrentUser(updatedUser);
        saveSupabaseUserProfile(updatedUser).catch(e => {});
      }
      return updated;
    });
    showNotification('Schedule Interval Removed');
  };

  const handleDeleteNote = async (id: string) => {
    if (!currentUser?.uid) return;
    const updated = vaultNotes.filter(n => n.id !== id);
    setVaultNotes(updated);
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
    }
    await deleteVaultNoteFromSupabase(id, currentUser.uid);
    showNotification('Note removed from your vault.');
  };

  const handleReorderNotes = async (newOrder: VaultNote[]) => {
    if (!currentUser?.uid) return;
    setVaultNotes(newOrder);
    await updateNoteOrder(newOrder, currentUser.uid);
  };

  const handleCreateNewNote = async () => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const defaultCover = [
      'bg-gradient-to-r from-violet-600 to-indigo-900',
      'bg-gradient-to-r from-emerald-600 to-teal-900',
      'bg-gradient-to-r from-rose-600 to-amber-900',
      'bg-gradient-to-r from-cyan-600 to-blue-900',
      'bg-gradient-to-r from-slate-700 to-slate-900'
    ][Math.floor(Math.random() * 5)];
    const defaultIcon = ['📝', '💡', '💻', '🧠', '🔬', '🧪', '📐', '🎨', '🚀'][Math.floor(Math.random() * 9)];
    const newId = generateUniqueId();
    const newNote: VaultNote = {
      id: newId,
      title: 'Untitled Note Page',
      subject: 'Syllabus General',
      content: `# Untitled Note

Write your thoughts using **Markdown** formatting. Click on the reader view tab to preview!

## Core Concepts
- Concept 1
- Concept 2`,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      icon: defaultIcon,
      coverBg: defaultCover,
      userId: uid,
      folder_id: activeVaultFolderId || null
    };
    try {
      const updated = [...vaultNotes, newNote];
      setVaultNotes(updated);
      (async () => {
       const newArr = updated;
       for (const n of newArr) {
          saveVaultNoteToSupabase(n).catch(()=>{});
       }
     })();
      setSelectedNoteId(newId);
      setNoteEditMode(true);
      awardStudentXP(currentUser, 'create_note', { uniqueItemId: newId });
      showNotification('Study canvas instantiated!');
    } catch (err: any) {
      console.error('Error creating note:', err);
    }
  };

  // Smart Board Draw functions
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = whiteboardRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = whiteboardRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    whiteboardHistory.current.push(canvas.toDataURL('image/png'));
    whiteboardRedoStack.current = [];

    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    lastXRef.current = x;
    lastYRef.current = y;
    startXRef.current = x;
    startYRef.current = y;
  };

  const drawOnCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = whiteboardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);

    if (canvasShape === 'free' || canvasTool === 'eraser') {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = canvasTool === 'eraser' ? '#0f172a' : brushColor;
      
      if (canvasTool === 'marker') {
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = brushSize * 2;
      } else if (canvasTool === 'brush') {
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = brushSize * 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = brushColor;
      } else if (canvasTool === 'fountain') {
        const dx = x - lastXRef.current;
        const dy = y - lastYRef.current;
        const speed = Math.sqrt(dx * dx + dy * dy);
        ctx.lineWidth = Math.max(1, brushSize - speed * 0.1);
      } else {
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
        ctx.lineWidth = canvasTool === 'eraser' ? brushSize * 4 : brushSize;
      }

      ctx.beginPath();
      ctx.moveTo(lastXRef.current, lastYRef.current);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Reset
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'whiteboard:draw',
          data: {
            type: 'draw',
            x1: lastXRef.current,
            y1: lastYRef.current,
            x2: x,
            y2: y,
            color: brushColor,
            size: brushSize,
            tool: canvasTool
          }
        }));
      }
    }

    lastXRef.current = x;
    lastYRef.current = y;
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = whiteboardRef.current;
    if (!canvas) return;
    
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x: endX, y: endY } = getCoordinates(e);

    if (canvasTool !== 'eraser' && canvasShape !== 'free') {
      ctx.save();
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (canvasShape === 'rect') {
        const w = endX - startXRef.current;
        const h = endY - startYRef.current;
        ctx.strokeRect(startXRef.current, startYRef.current, w, h);

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'whiteboard:draw',
            data: { type: 'shape:rect', x: startXRef.current, y: startYRef.current, w, h, color: brushColor, size: brushSize }
          }));
        }
      } else if (canvasShape === 'circle') {
        const r = Math.sqrt(Math.pow(endX - startXRef.current, 2) + Math.pow(endY - startYRef.current, 2));
        ctx.beginPath();
        ctx.arc(startXRef.current, startYRef.current, r, 0, 2 * Math.PI);
        ctx.stroke();

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'whiteboard:draw',
            data: { type: 'shape:circle', x: startXRef.current, y: startYRef.current, radius: r, color: brushColor, size: brushSize }
          }));
        }
      } else if (canvasShape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(startXRef.current + (endX - startXRef.current) / 2, startYRef.current);
        ctx.lineTo(endX, endY);
        ctx.lineTo(startXRef.current, endY);
        ctx.closePath();
        ctx.stroke();
      } else if (canvasShape === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(startXRef.current, startYRef.current);
        ctx.lineTo(endX, endY);
        const angle = Math.atan2(endY - startYRef.current, endX - startXRef.current);
        ctx.lineTo(endX - 20 * Math.cos(angle - Math.PI / 6), endY - 20 * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 20 * Math.cos(angle + Math.PI / 6), endY - 20 * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (canvasShape === 'star') {
        const r = Math.sqrt(Math.pow(endX - startXRef.current, 2) + Math.pow(endY - startYRef.current, 2));
        const spikes = 5;
        const outerRadius = r;
        const innerRadius = r / 2;
        let rot = Math.PI / 2 * 3;
        let x = startXRef.current;
        let y = startYRef.current;
        let step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(startXRef.current, startYRef.current - outerRadius);
        for (let i = 0; i < spikes; i++) {
          x = startXRef.current + Math.cos(rot) * outerRadius;
          y = startYRef.current + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y);
          rot += step;
          x = startXRef.current + Math.cos(rot) * innerRadius;
          y = startYRef.current + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y);
          rot += step;
        }
        ctx.lineTo(startXRef.current, startYRef.current - outerRadius);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const clearCanvas = () => {
    const canvas = whiteboardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    showNotification('Canvas cleared.');

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'whiteboard:clear'
      }));
    }
  };

  const drawShapeOnWhiteboard = (shape: string, text?: string) => {
    setTimeout(() => {
      const canvas = whiteboardRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.beginPath();
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = brushColor;
      ctx.fillStyle = brushColor;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = Math.min(canvas.width, canvas.height) / 4;

      if (shape === 'circle') {
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (shape === 'rect' || shape === 'rectangle' || shape === 'square') {
        ctx.rect(cx - r, cy - r, r * 2, r * 2);
        ctx.stroke();
      } else if (shape === 'triangle') {
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy + r);
        ctx.lineTo(cx - r, cy + r);
        ctx.closePath();
        ctx.stroke();
      } else if (shape === 'arrow') {
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx + r - 20, cy - 20);
        ctx.moveTo(cx + r, cy);
        ctx.lineTo(cx + r - 20, cy + 20);
        ctx.stroke();
      } else if (shape === 'star') {
        const spikes = 5;
        const outerRadius = r;
        const innerRadius = r / 2;
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius;
          y = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y);
          rot += step;
          x = cx + Math.cos(rot) * innerRadius;
          y = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y);
          rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.stroke();
      } else if (shape === 'text' && text) {
        ctx.font = `bold ${Math.max(24, canvas.height / 20)}px monospace`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        
        const lines = text.split(',');
        const lineHeight = parseInt(ctx.font, 10) * 1.2;
        lines.forEach((line, index) => {
          ctx.fillText(line, cx, cy - (lines.length * lineHeight) / 2 + index * lineHeight);
        });
      }

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'whiteboard:drawShape',
          data: { shape, cx, cy, r, color: brushColor, size: brushSize, text }
        }));
      }
    }, 100);
  };

  // Expose methods for Orion
  useEffect(() => {
    (window as any).whiteboardCreateSlide = () => {
      setWhiteboardSlides(prev => [...prev, '']);
      setCurrentSlideIndex(whiteboardSlides.length);
      clearCanvas();
    };
    (window as any).whiteboardNextSlide = () => {
      if (currentSlideIndex < whiteboardSlides.length - 1) {
        loadSlide(currentSlideIndex + 1);
      }
    };
    (window as any).whiteboardPrevSlide = () => {
      if (currentSlideIndex > 0) {
        loadSlide(currentSlideIndex - 1);
      }
    };
    (window as any).whiteboardDuplicateSlide = () => {
      const snap = whiteboardRef.current?.toDataURL('image/png') || '';
      setWhiteboardSlides(prev => {
        const next = [...prev];
        next.splice(currentSlideIndex + 1, 0, snap);
        return next;
      });
      setCurrentSlideIndex(idx => idx + 1);
    };
    (window as any).whiteboardDeleteSlide = () => {
      if (whiteboardSlides.length <= 1) {
         clearCanvas();
         setWhiteboardSlides(['']);
         setCurrentSlideIndex(0);
         return;
      }
      setWhiteboardSlides(prev => prev.filter((_, i) => i !== currentSlideIndex));
      setCurrentSlideIndex(idx => Math.max(0, idx - 1));
      setTimeout(() => {
         loadSlide(Math.max(0, currentSlideIndex - 1));
      }, 50);
    };
    
    (window as any).whiteboardUndo = () => {
      const canvas = whiteboardRef.current;
      if (canvas && whiteboardHistory.current.length > 0) {
        whiteboardRedoStack.current.push(canvas.toDataURL('image/png'));
        const previousState = whiteboardHistory.current.pop();
        if (previousState) {
          clearCanvas();
          const img = new Image();
          img.onload = () => canvas.getContext('2d')?.drawImage(img, 0, 0);
          img.src = previousState;
        }
      }
    };

    (window as any).whiteboardRedo = () => {
      const canvas = whiteboardRef.current;
      if (canvas && whiteboardRedoStack.current.length > 0) {
        whiteboardHistory.current.push(canvas.toDataURL('image/png'));
        const nextState = whiteboardRedoStack.current.pop();
        if (nextState) {
          clearCanvas();
          const img = new Image();
          img.onload = () => canvas.getContext('2d')?.drawImage(img, 0, 0);
          img.src = nextState;
        }
      }
    };

    return () => {
      delete (window as any).whiteboardCreateSlide;
      delete (window as any).whiteboardNextSlide;
      delete (window as any).whiteboardPrevSlide;
      delete (window as any).whiteboardDuplicateSlide;
      delete (window as any).whiteboardDeleteSlide;
      delete (window as any).whiteboardUndo;
      delete (window as any).whiteboardRedo;
    };
  }, [currentSlideIndex, whiteboardSlides]);

  const loadSlide = (index: number) => {
    // Save current slide first
    const canvas = whiteboardRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const newSlides = [...whiteboardSlides];
      newSlides[currentSlideIndex] = dataUrl;
      setWhiteboardSlides(newSlides);
    }
    
    // Load next slide
    setCurrentSlideIndex(index);
    clearCanvas();
    if (whiteboardSlides[index]) {
      const img = new Image();
      img.onload = () => {
        const ctx = whiteboardRef.current?.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
      };
      img.src = whiteboardSlides[index];
    }
  };

  // Robust Whiteboard canvas resize setup
  useEffect(() => {
    if (activeTab === 'whiteboard') {
      const canvas = whiteboardRef.current;
      if (!canvas) return;
      
      const updateCanvasSize = () => {
        const parent = canvas.parentElement;
        if (parent) {
          // Save drawing before resize 
          const ctx = canvas.getContext('2d');
          let tempCanvas: HTMLCanvasElement | null = null;
          if (ctx && canvas.width > 0 && canvas.height > 0) {
            tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tCtx = tempCanvas.getContext('2d');
            if (tCtx) tCtx.drawImage(canvas, 0, 0);
          }

          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;

          // Restore drawing
          if (ctx && tempCanvas) {
            ctx.drawImage(tempCanvas, 0, 0);
          }
        }
      };

      // Initial size
      updateCanvasSize();

      // Observe parent for resize
      const observer = new ResizeObserver(() => {
        updateCanvasSize();
      });

      if (canvas.parentElement) {
        observer.observe(canvas.parentElement);
      }

      return () => observer.disconnect();
    }
  }, [activeTab]);

  // Teacher Presentation Broadcasts
  const handleTeacherBroadcast = () => {
    const summaryBullets = [
      'Understand binary tree balance formulas.',
      'Rotations execute structural shift O(1) in-place pointers.',
      'Check heights at each child branch after push methods.'
    ];

    const initialLesson: Lesson = {
      id: 'les-active',
      title: 'Structural Rotations in Balanced Trees',
      subject: currentUser?.specialtySubject || 'Computer Science',
      presentedBy: currentUser?.name || 'Class Professor',
      slides: summaryBullets,
      currentSlideIndex: 0,
      isActive: true,
      smartBoardNotes: 'Verify standard AVL tree rotation vectors: Left-Left vs. Left-Right double rotations.'
    };

    setActiveBroadcast(initialLesson);
    setLessons(prev => [initialLesson, ...prev]);
    showNotification('Lesson presentation is now Live Broadcasted to all sections!');
  };

  const handleStopBroadcast = () => {
    setActiveBroadcast(null);
    showNotification('Lesson stream terminated.');
  };

  // Student Classroom interaction actions
  const sendStudentSignal = (type: string) => {
    setUnderstandingSignals(prev => {
      const counter = prev[type] || 0;
      return { ...prev, [type]: counter + 1 };
    });
    showNotification(`Status token "${type.toUpperCase()}" transmitted to your faculty dashboards.`);
  };

  // Material Resource Hub additions
  const handleAddMaterial = async (titleText?: string, descText?: string) => {
    const finalTitle = titleText || newMaterialTitle;
    const finalDesc = descText || newMaterialDesc;

    if (!finalTitle.trim() || !finalDesc.trim()) {
      showNotification('Required: resource name and description tags.');
      return;
    }

    const matId = generateUniqueId();
    const docItem: MaterialResource = {
      id: matId,
      title: finalTitle.trim(),
      subject: newMaterialSubject,
      type: newMaterialType,
      description: finalDesc.trim(),
      uploadedBy: currentUser?.name || 'Academic Faculty',
      uploaderUid: currentUser?.uid || '',
      uploaderHouse: currentUser?.house || '',
      uploaderSection: currentUser?.section || '',
      createdAt: new Date().toISOString().split(',')[0],
      created_at: Date.now(),
      isPublic: newMaterialIsPublic,
      visibleToGrades: newMaterialIsPublic ? undefined : newMaterialGrades,
      visibleToSections: newMaterialIsPublic ? undefined : newMaterialSections,
      visibleToHouses: newMaterialIsPublic ? undefined : newMaterialHouses,
      downloads: 1,
      likes: 0,
      likedBy: [],
      views: 1,
      isVerified: effectiveRole === 'teacher',
      comments: []
    };

    try {
      await saveSupabaseMaterial(docItem);
      // Optimistic update: show immediately without waiting for refetch
      setMaterials(prev => [docItem, ...prev]);
      setNewMaterialTitle('');
      setNewMaterialDesc('');
      
      // Reset permissions state fields
      setNewMaterialIsPublic(true);
      setNewMaterialGrades([]);
      setNewMaterialSections([]);
      setNewMaterialHouses([]);

      showNotification('Academic resource shared successfully on Materials Hub!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `materials/${matId}`);
    }
  };

  // Toggle Like Material
  const toggleLikeMaterial = async (mat: MaterialResource) => {
    if (!currentUser || !auth.currentUser) return;
    const myUid = currentUser?.uid || "";
    const isLiked = mat.likedBy?.includes(myUid);
    const updatedLikedBy = isLiked
      ? (mat.likedBy || []).filter(u => u !== myUid)
      : [...(mat.likedBy || []), myUid];
    const updatedLikesCount = updatedLikedBy.length;
    
    // popular award threshold
    const becamePopular = !isLiked && updatedLikesCount === 5;
    
    const nextMat = { ...mat, likes: updatedLikesCount, likedBy: updatedLikedBy };
    try {
      await saveSupabaseMaterial(nextMat);
      setMaterials(prev => prev.map(m => m.id === mat.id ? nextMat : m));
      if (becamePopular && mat.uploaderHouse) {
        showNotification(`❤️ Popular Item! "${mat.title}" crossed 5 likes.`);
      }
    } catch (err) {
      console.error("Failed to update like count in Supabase:", err);
    }
  };

  // Open material document inside StudentOS without external tab redirect
  const handleOpenMaterialDocument = async (mat: MaterialResource) => {
    const finalUrl = mat.url || mat.fileUrl || mat.file_url || mat.attachment_url;
    if (finalUrl) {
      setInAppViewerDoc({
        url: finalUrl,
        title: mat.title,
        fileName: mat.fileName || mat.title,
        fileType: mat.fileType || mat.type
      });
      incrementViewsMaterial(mat);
    } else {
      showNotification('Document file is not available.');
    }
  };

  // Download material wrapper (increments download tally without window.open navigation)
  const handleDownloadMaterial = async (mat: MaterialResource) => {
    const finalUrl = mat.url || mat.fileUrl || mat.file_url || mat.attachment_url;
    if (finalUrl) {
      const name = mat.fileName || mat.title || 'material';
      if (typeof (window as any).openExternalDownload === 'function') {
        (window as any).openExternalDownload(finalUrl, name);
      } else {
        const a = document.createElement('a');
        a.href = finalUrl;
        a.download = name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Increment downloads
      const updatedDownloads = (mat.downloads || 0) + 1;
      const nextMat = { ...mat, downloads: updatedDownloads };
      try {
        await saveSupabaseMaterial(nextMat);
        setMaterials(prev => prev.map(m => m.id === mat.id ? nextMat : m));
      } catch (err) {
        console.error("Failed to update download count in Supabase:", err);
      }
    } else {
      showNotification('Link not available for this material.');
    }
  };

  // Increment view counter
  const incrementViewsMaterial = async (mat: MaterialResource) => {
    const updatedViews = (mat.views || 0) + 1;
    const nextMat = { ...mat, views: updatedViews };
    try {
      await saveSupabaseMaterial(nextMat);
      setMaterials(prev => prev.map(m => m.id === mat.id ? nextMat : m));
    } catch (err) {
      console.error("Failed to update view count in Supabase:", err);
    }
  };

  // Add Comment on Material
  const handleAddComment = async (mat: MaterialResource) => {
    if (!newCommentText.trim()) return;
    const commentId = generateUniqueId();
    const newComment = {
      id: commentId,
      author: currentUser?.name || 'Academic Scholar',
      house: currentUser?.house || undefined,
      text: newCommentText.trim(),
      createdAt: new Date().toISOString().split(',')[0]
    };
    const updatedComments = [...(mat.comments || []), newComment];
    const nextMat = { ...mat, comments: updatedComments };
    try {
      await saveSupabaseMaterial(nextMat);
      setMaterials(prev => prev.map(m => m.id === mat.id ? nextMat : m));
      setNewCommentText('');
      showNotification('Comment registered successfully in peer discussion threads!');
    } catch (err) {
      console.error("Failed to add comment to Supabase:", err);
    }
  };

  // Verify Material (Teacher action)
  const handleVerifyMaterial = async (mat: MaterialResource) => {
    if (effectiveRole !== 'teacher') return;
    const nextState = !mat.isVerified;
    const nextMat = { ...mat, isVerified: nextState };
    try {
      await saveSupabaseMaterial(nextMat);
      setMaterials(prev => prev.map(m => m.id === mat.id ? nextMat : m));
      if (nextState) {
        const houseOfUploader = mat.uploaderHouse as HouseType;
        if (houseOfUploader) {
          showNotification(`✅ Faculty Verified! ${mat.title} is now peer gold-standard!`);
        } else {
          showNotification('Material marked verified!');
        }
      } else {
        showNotification('Verification removed.');
      }
    } catch (err) {
      console.error("Failed to verify material in Supabase:", err);
    }
  };

  // Save Bookmarks per user
  const toggleBookmarkMaterial = (id: string) => {
    setSavedMaterialIds(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(mId => mId !== id) : [...prev, id];
      if (currentUser) {
        const uid = currentUser.uid || currentUser.email || 'guest';
        try {
          localStorage.setItem(`s_os_saved_materials_${uid}`, JSON.stringify(next));
        } catch (_) {}
        const updatedUser = {
          ...currentUser,
          raw_data: {
            ...(currentUser.raw_data || {}),
            savedMaterialIds: next
          }
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('s_os_user', JSON.stringify(updatedUser));
        saveSupabaseUserProfile(updatedUser).catch(() => {});
      }
      showNotification(exists ? 'Material removed from bookmarks.' : 'Material saved to private bookmarks desk!');
      return next;
    });
  };

  // Comprehensive Profile Account Switcher — switches active user account & syncs all per-user data
  const SWITCHABLE_PROFILE_ACCOUNTS: Array<{
    uid: string;
    name: string;
    role: UserRole;
    email: string;
    house?: HouseType;
    grade?: string;
    section?: SectionType;
  }> = [
    { uid: 'demo-super', name: 'Naitik Kashyap', role: 'super_admin', email: 'naitik.kashyap0015@gmail.com', house: 'Ruby', grade: 'Grade 10', section: 'Astra' },
    { uid: 'demo-student-uid', name: 'Aarav Sharma', role: 'student', email: 'student@demo.com', house: 'Ruby', grade: 'Grade 10', section: 'Astra' },
    { uid: 'demo-teacher-uid', name: 'Prof. Elara Vance', role: 'teacher', email: 'teacher@demo.com', house: 'Sapphire' },
    { uid: 'demo-parent-uid', name: 'Rajesh Kashyap', role: 'parent', email: 'parent@demo.com', house: 'Ruby' },
    { uid: 'demo-admin-uid', name: 'Principal Arthur Vance', role: 'admin', email: 'admin@demo.com', house: 'Emerald' }
  ];

  const getAvailableSwitchAccounts = () => {
    const map = new Map<string, { uid: string; name: string; role: UserRole; email: string; house?: HouseType; grade?: string; section?: SectionType }>();
    for (const acc of SWITCHABLE_PROFILE_ACCOUNTS) {
      map.set(acc.uid, acc);
    }
    for (const rec of recentAccounts) {
      if (!rec.uid) continue;
      // Avoid duplicating built-in demo accounts with different UIDs
      const existingByEmail = Array.from(map.values()).find(a => a.email.toLowerCase() === (rec.email || '').toLowerCase() && a.role === rec.role);
      if (!existingByEmail && !map.has(rec.uid)) {
        map.set(rec.uid, {
          uid: rec.uid,
          name: rec.name || 'Veylentra User',
          role: (rec.role as UserRole) || 'student',
          email: rec.email || `${rec.uid}@studentos.edu`,
          house: (rec as any).house,
          grade: (rec as any).grade
        });
      }
    }
    if (currentUser?.uid && !map.has(currentUser.uid)) {
      const existingByEmail = Array.from(map.values()).find(a => a.email.toLowerCase() === (currentUser.email || '').toLowerCase() && a.role === currentUser.role);
      if (!existingByEmail) {
        map.set(currentUser.uid, {
          uid: currentUser.uid,
          name: currentUser.name || 'Current User',
          role: currentUser.role || 'student',
          email: currentUser.email || 'user@studentos.edu',
          house: currentUser.house,
          grade: currentUser.grade,
          section: currentUser.section
        });
      }
    }
    return Array.from(map.values());
  };

  const handleSwitchProfileAccount = async (targetUidOrEmail: string) => {
    const allAccounts = getAvailableSwitchAccounts();
    const matched = allAccounts.find(a => a.uid === targetUidOrEmail || a.email.toLowerCase() === targetUidOrEmail.toLowerCase());
    if (!matched) return;

    // 1. Save outgoing user's latest state before switching
    if (currentUser && currentUser.uid) {
      const outgoingProfile: UserProfile = {
        ...currentUser,
        raw_data: {
          ...(currentUser.raw_data || {}),
          tasks,
          schedules,
          savedMaterialIds
        }
      };
      saveLocalProfileBackup(outgoingProfile);
      saveSupabaseUserProfile(outgoingProfile).catch(() => {});
    }

    // 2. Clear role simulation overrides & chat/AI caches so new user's data loads cleanly
    setSimulatedRole(null);
    setIsSuperAdmin(matched.role === 'super_admin');
    aiChatsSyncingFor.current = null;
    clearChatCache();
    setActiveChatTargetId('group-all');
    setSelectedMaterialForAi(null);
    setPreviewMaterial(null);

    // 3. Build immediate profile from local backup or canonical account default (never copying outgoing user's raw_data)
    const defaultAcctProfile = getDefaultProfileForAccount(matched.uid, matched.email);
    let nextProfile: UserProfile = defaultAcctProfile || {
      uid: matched.uid,
      name: matched.name,
      email: matched.email,
      role: matched.role,
      house: matched.house || 'Ruby',
      grade: matched.grade || (matched.role === 'student' ? 'Grade 10' : ''),
      section: matched.section || (matched.role === 'student' ? 'Astra' : undefined),
      accountStatus: 'approved',
      studyHours: 12,
      quizzesTaken: 4,
      streakDays: 5,
      raw_data: {
        tasks: [],
        schedules: [],
        savedMaterialIds: []
      }
    };

    try {
      const storedRaw = localStorage.getItem(`s_os_profile_store_${matched.uid.toLowerCase()}`) ||
                        localStorage.getItem(`s_os_profile_store_${matched.email.toLowerCase()}`);
      if (storedRaw) {
        const parsedStored = JSON.parse(storedRaw);
        nextProfile = {
          ...nextProfile,
          ...parsedStored,
          uid: matched.uid,
          role: matched.role,
          raw_data: {
            ...(nextProfile.raw_data || {}),
            ...(parsedStored.raw_data || {})
          }
        };
      }
    } catch (_) {}

    // 4. Immediately activate the new profile & sync per-user states
    setCurrentUser(nextProfile);
    localStorage.setItem('s_os_user', JSON.stringify(nextProfile));
    saveLocalProfileBackup(nextProfile);
    updateRecentAccounts(nextProfile);

    setTasks(nextProfile.raw_data?.tasks || []);
    setSchedules(nextProfile.raw_data?.schedules || []);
    setSavedMaterialIds(nextProfile.raw_data?.savedMaterialIds || []);

    // 5. Adjust activeTab if needed for the new account's role
    if (matched.role === 'parent') {
      setActiveTab('parent_portal');
    } else if (activeTab === 'parent_portal') {
      setActiveTab('dashboard');
    } else if (activeTab === 'faculty' && matched.role !== 'teacher') {
      setActiveTab('dashboard');
    } else if (activeTab === 'admin' && matched.role !== 'admin' && matched.role !== 'super_admin') {
      setActiveTab('dashboard');
    }

    showNotification(`✓ Switched account to ${nextProfile.name} (${matched.role.replace('_', ' ')}) — synced materials, chats & workspace`);

    // 6. Reload per-user Notes, AI Buddy Chats, Materials, Peer Messages, Chat Rooms, and Notifications
    const targetUid = nextProfile.uid;
    getSupabaseMaterials().then(list => setMaterials(list)).catch(() => {});
    getVaultNotes(targetUid).then(notes => {
      setVaultNotes(notes);
      setSelectedNoteId(notes[0]?.id || null);
    }).catch(() => {});
    getAiBuddyChats(targetUid).then(threads => {
      if (threads && threads.length > 0) {
        setAiThreads(threads as any);
        setActiveThreadId(threads[0].id);
      }
    }).catch(() => {});
    getPeerMessages(true).then(msgs => {
      if (msgs) setChats(msgs);
    }).catch(() => {});
    getChatRooms(targetUid, true).then(rooms => {
      if (rooms) setChatRooms(rooms);
    }).catch(() => {});
    getAppNotifications(targetUid, nextProfile.grade, nextProfile.section, nextProfile.role).then(list => {
      if (list) setNotifications(list);
    }).catch(() => {});

    // 7. Also sync from remote Supabase user_profiles in background
    try {
      const remoteProfile = await getSupabaseUserProfile(matched.uid, matched.email, true);
      if (remoteProfile) {
        const mergedProfile: UserProfile = {
          ...nextProfile,
          ...remoteProfile,
          uid: matched.uid,
          role: matched.role,
          raw_data: {
            ...(nextProfile.raw_data || {}),
            ...(remoteProfile.raw_data || {})
          }
        };
        setCurrentUser(mergedProfile);
        localStorage.setItem('s_os_user', JSON.stringify(mergedProfile));
        saveLocalProfileBackup(mergedProfile);
        if (mergedProfile.raw_data?.tasks) setTasks(mergedProfile.raw_data.tasks);
        if (mergedProfile.raw_data?.schedules) setSchedules(mergedProfile.raw_data.schedules);
        if (mergedProfile.raw_data?.savedMaterialIds) setSavedMaterialIds(mergedProfile.raw_data.savedMaterialIds);
      }
    } catch (_) {}
  };

  // Trigger AI analysis with raw content context
  const handleTriggerMaterialAi = async (mat: MaterialResource, action: string) => {
    setAiActionLoading(true);
    setAiActionType(action);
    setSelectedMaterialForAi(mat);
    setAiActionResultText('');
    
    let contentContext = `Subject Category: ${mat.subject}. Description Detail: ${mat.description}. Type classification: ${mat.type}. Uploader role stats: ${mat.uploadedBy}. target grades: ${mat.visibleToGrades?.join('') || 'All Grades'}.`;
    
    incrementViewsMaterial(mat);
    
    try {
      let resultText = '';
      try {
        const response = await fetch('/api/ai/material-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: mat.title,
            description: mat.description,
            content: contentContext,
            action: action,
            userQuestion: aiUserQuestion
          })
        });
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        resultText = data.text;
      } catch (err: any) {
        console.error("Material AI action error:", err?.message || err);
        setAiActionResultText("### ⚠️ AI Unavailable\n\nAI is temporarily unavailable. Please try again.");
        showNotification('AI is temporarily unavailable. Please try again.');
        return;
      }
      
      setAiActionResultText(resultText);
      showNotification(`✨ AI ${action.toUpperCase()} processed successfully!`);
    } catch (err: any) {
      console.error('AI execution failed:', err);
      showNotification('AI is temporarily unavailable. Please try again.');
      setAiActionResultText(`### ⚠️ AI Unavailable\n\nAI is temporarily unavailable. Please try again.`);
    } finally {
      setAiActionLoading(false);
    }
  };

  // Export AI result to various templates
  const handleExportAiResult = (mat: MaterialResource, format: 'txt' | 'html' | 'pdf') => {
    if (!aiActionResultText) return;
    const baseHeader = `=========================================
STUDENTOS ACADEMIC AI REPORT
Material: ${mat.title}
Subject: ${mat.subject}
Date: ${new Date().toLocaleDateString()}
=========================================

`;
    
    if (format === 'txt') {
      const fileContent = baseHeader + aiActionResultText;
      const file = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      const filename = `${mat.title.replace(/\s+/g, "_")}_AI_${aiActionType}.txt`;
      if (typeof (window as any).downloadAIVoice === 'function') {
        (window as any).downloadAIVoice(file, filename);
      } else {
        const element = document.createElement("a");
        element.href = URL.createObjectURL(file);
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }
      showNotification('Notes saved as plain document!');
    } else if (format === 'html') {
      const richHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>AI Report - ${mat.title}</title>
          <style>
            body { font-family: sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px; line-height: 1.6; }
            .wrapper { max-width: 800px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; }
            h1, h2, h3 { color: #f8fafc; font-family: monospace; }
            pre { background: #020617; padding: 15px; border-radius: 8px; color: #a5f3fc; overflow-x: auto; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <h1>📚 StudentOS AI Report Dashboard</h1>
            <p><b>Material:</b> ${mat.title} | <b>Subject:</b> ${mat.subject}</p>
            <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
            <div>${aiActionResultText.replace(/\n/g, '<br>')}</div>
          </div>
        </body>
        </html>
      `;
      const file = new Blob([richHtml], { type: 'text/html;charset=utf-8' });
      const filename = `${mat.title.replace(/\s+/g, "_")}_AI_${aiActionType}.html`;
      if (typeof (window as any).downloadAIVoice === 'function') {
        (window as any).downloadAIVoice(file, filename);
      } else {
        const element = document.createElement("a");
        element.href = URL.createObjectURL(file);
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }
      showNotification('Notes saved as rich styled webpage HTML!');
    } else if (format === 'pdf') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
          <head>
            <title>Print StudentOS AI Report - ${mat.title}</title>
            <style>
              body { font-family: monospace; padding: 30px; color: #000; background: #fff; line-height: 1.5; }
              h1 { border-bottom: 2px solid #000; padding-bottom: 5px; }
              pre { background: #f4f4f5; padding: 10px; border: 1px solid #e4e4e7; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <h1>📚 StudentOS Faculty Resource Analysis</h1>
            <p><b>Title:</b> ${mat.title} | <b>Category Focus:</b> ${mat.subject}</p>
            <p><b>Uploader Contact:</b> ${mat.uploadedBy} | <b>Date:</b> ${mat.createdAt}</p>
            <hr>
            <div style="font-family: sans-serif; white-space: pre-wrap;">${aiActionResultText}</div>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  // Upload file to storage / Firestore
  const handleUploadFileMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[UPLOAD TRACE] 1. Form submitted / Upload button clicked");
    console.log("[UPLOAD TRACE] 2. handleUploadFileMaterial entered");
    
    const titleInput = (document.getElementById('upload-title') as HTMLInputElement)?.value;
    const descInput = (document.getElementById('upload-desc') as HTMLTextAreaElement)?.value;
    const subjectInput = (document.getElementById('upload-subject') as HTMLSelectElement)?.value;
    const typeInput = (document.getElementById('upload-type') as HTMLSelectElement)?.value as any;
    const yearInput = (document.getElementById('upload-year') as HTMLInputElement)?.value;
    const fileInput = document.getElementById('upload-file') as HTMLInputElement;
    
    if (!titleInput || !descInput || !subjectInput) {
      console.warn("[UPLOAD TRACE] Validation failed: Name, Description, and Subject are required.");
      showNotification('Please fill in Name, Description, and Subject!');
      return;
    }

    const hasFile = !!(fileInput?.files && fileInput.files[0]);
    console.log(`[UPLOAD TRACE] 2.1 selectedFile is null? ${!hasFile}`);
    if (hasFile) {
      const file = fileInput.files[0];
      console.log(`[UPLOAD TRACE] 2.2 Selected file metadata: Name="${file.name}", Size=${file.size} bytes, Type="${file.type}"`);
      
      const isDuplicate = materials.some(mat => (mat.fileName === file.name) || (mat.title.trim().toLowerCase() === titleInput.trim().toLowerCase()));
      if (isDuplicate) {
        console.warn("[UPLOAD TRACE] Validation failed: Duplicate file or title detected in state.");
        showNotification('❌ Duplicate file detected. A file with this name or title already exists in the Material Hub.');
        return;
      }
    } else {
      console.log("[UPLOAD TRACE] No file selected, proceeding with mock attachment URL.");
      const isDuplicate = materials.some(mat => mat.title.trim().toLowerCase() === titleInput.trim().toLowerCase());
      if (isDuplicate) {
        console.warn("[UPLOAD TRACE] Validation failed: Duplicate material title detected in state.");
        showNotification('❌ Duplicate material detected. A material with this title already exists.');
        return;
      }
    }

    const matId = generateUniqueId();
    let fileUrl = 'https://example.com/mock.pdf';
    let fName: string | undefined = undefined;
    let fType: string | undefined = undefined;
    let fSize: number | undefined = undefined;
    let supabaseFilePath: string | undefined = undefined;
    
    if (fileInput?.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      if (file.size > 200 * 1024 * 1024) { // Increase limit to 200MB since we are using Firebase Storage
        console.warn("[UPLOAD TRACE] Validation failed: File exceeds limit of 200 MB");
        showNotification('⚠️ File exceeds storage limit of 200 MB.');
        return;
      }
      fName = file.name;
      fType = file.type;
      fSize = file.size;
      
      showNotification('Uploading file securely...');
      console.log("[UPLOAD TRACE] 3. uploadFileToStorage called for file", file.name);
      try {
        const { url, path } = await uploadFileToStorage(file, 'materials');
        
        console.log("[UPLOAD TRACE] 4. uploadFileToStorage returned success!");
        console.log("[UPLOAD TRACE] 4.1 Returned URL:", url);
        console.log("[UPLOAD TRACE] 4.2 Returned Path:", path);

        fileUrl = url;
        supabaseFilePath = path;
             
        showNotification('✓ File uploaded successfully!');
      } catch (err: any) {
        console.error('[UPLOAD TRACE] 3.1 uploadFileToStorage failed with error:', err);
        showNotification(`❌ Upload failed: ${err.message || String(err)}`);
        return;
      }
    }

    const docItem: MaterialResource = {
      id: matId,
      title: titleInput.trim(),
      subject: subjectInput,
      type: typeInput,
      url: fileUrl,
      storagePath: supabaseFilePath,
      fileName: fName,
      fileType: fType,
      fileSize: fSize,
      description: descInput.trim(),
      uploadedBy: currentUser?.name || 'Faculty Representative',
      uploaderUid: currentUser?.uid || '',
      uploaderHouse: currentUser?.house || '',
      uploaderSection: currentUser?.section || '',
      createdAt: new Date().toISOString().split(',')[0],
      created_at: Date.now(),
      isPublic: newMaterialIsPublic,
      visibleToGrades: newMaterialIsPublic ? undefined : newMaterialGrades,
      visibleToSections: newMaterialIsPublic ? undefined : newMaterialSections,
      visibleToHouses: newMaterialIsPublic ? undefined : newMaterialHouses,
      downloads: 1, // uploader downloaded it first
      likes: 0,
      likedBy: [],
      views: 1,
      isVerified: effectiveRole === 'teacher' || effectiveRole === 'admin' || effectiveRole === 'super_admin', // auto verify staff!
      comments: [],
      visibility: newMaterialVisibility,
      questionPaperYear: yearInput ? yearInput.trim() : undefined,
      folder_id: activeMaterialFolderId
    };

    console.log("[UPLOAD TRACE] 5. Metadata object constructed before save:", JSON.stringify(docItem, null, 2));

    try {
      await saveSupabaseMaterial(docItem);
      // Optimistic update: show in list immediately without waiting for refetch
      setMaterials(prev => [docItem, ...prev]);

      // Reset state elements
      setNewMaterialGrades([]);
      setNewMaterialSections([]);
      setNewMaterialHouses([]);
      setNewMaterialIsPublic(true);
      
      showNotification('Success: Course material published to the Material Hub!');
      setOpenUploadModal(false);
    } catch (err: any) {
      console.error('[UPLOAD TRACE] Material save failed:', err);
      showNotification(`❌ Failed to save material: ${err.message || String(err)}`);
    }
  };

  // Quick Sidebar Uploader logic
  const handleQuickUploadDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setQuickUploadDragActive(true);
    } else if (e.type === 'dragleave') {
      setQuickUploadDragActive(false);
    }
  };

  const handleQuickUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickUploadDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setQuickUploadFile(file);
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setQuickUploadTitle(nameWithoutExt);
      showNotification(`File "${file.name}" ready for instant share!`);
    }
  };

  const handleQuickUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setQuickUploadFile(file);
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setQuickUploadTitle(nameWithoutExt);
      showNotification(`File "${file.name}" loaded for quick publish.`);
    }
  };

  const handleQuickUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[UPLOAD TRACE] 1. Quick Upload submitted / Form submitted");
    console.log("[UPLOAD TRACE] 2. handleQuickUploadSubmit entered");

    if (!quickUploadFile) {
      console.warn("[UPLOAD TRACE] Validation failed: quickUploadFile is null.");
      showNotification('Please select or drop a file first!');
      return;
    }
    if (!quickUploadTitle.trim()) {
      console.warn("[UPLOAD TRACE] Validation failed: quickUploadTitle is empty.");
      showNotification('Please provide a title for your shared file!');
      return;
    }

    console.log(`[UPLOAD TRACE] 2.1 selectedFile is null? false`);
    console.log(`[UPLOAD TRACE] 2.2 Selected file metadata: Name="${quickUploadFile.name}", Size=${quickUploadFile.size} bytes, Type="${quickUploadFile.type}"`);

    if (quickUploadFile.size > 200 * 1024 * 1024) {
      console.warn("[UPLOAD TRACE] Validation failed: Quick Upload file exceeds 200 MB storage limit.");
      showNotification('⚠️ Quick Upload file exceeds 200 MB storage limit.');
      setQuickUploadIsUploading(false);
      return;
    }

    setQuickUploadIsUploading(true);
    const matId = generateUniqueId();
    let fileUrl = 'https://example.com/mock.pdf';
    let supabaseFilePath: string | undefined = undefined;

    try {
      showNotification(`Uploading "${quickUploadFile.name}"...`);
      console.log("[UPLOAD TRACE] 3. uploadFileToStorage called for quick file", quickUploadFile.name);
      try {
        const { url, path } = await uploadFileToStorage(quickUploadFile, 'materials');
        
        console.log("[UPLOAD TRACE] 4. uploadFileToStorage returned success!");
        console.log("[UPLOAD TRACE] 4.1 Returned URL:", url);
        console.log("[UPLOAD TRACE] 4.2 Returned Path:", path);

        fileUrl = url;
        supabaseFilePath = path;

        showNotification('✓ File uploaded successfully!');
      } catch (err: any) {
        console.error('[UPLOAD TRACE] 3.1 uploadFileToStorage failed with error:', err);
        showNotification(`❌ Upload failed: ${err.message || String(err)}`);
        setQuickUploadIsUploading(false);
        return;
      }

      const docItem: MaterialResource = {
        id: matId,
        title: quickUploadTitle.trim(),
        subject: quickUploadSubject,
        type: quickUploadType as any,
        url: fileUrl,
        storagePath: supabaseFilePath,
        fileName: quickUploadFile.name,
        fileType: quickUploadFile.type,
        fileSize: quickUploadFile.size,
        description: `Direct share upload: "${quickUploadTitle.trim()}" in ${quickUploadSubject}.`,
        uploadedBy: currentUser?.name || 'Class Peer',
        uploaderUid: currentUser?.uid || '',
        uploaderHouse: currentUser?.house || '',
        uploaderSection: currentUser?.section || '',
        createdAt: new Date().toISOString().split(',')[0],
        isPublic: true,
        downloads: 1,
        likes: 0,
        likedBy: [],
        views: 1,
        isVerified: effectiveRole === 'teacher',
        comments: [],
        folder_id: activeMaterialFolderId
      };

      console.log("[UPLOAD TRACE] 5. Metadata object constructed before save:", JSON.stringify(docItem, null, 2));

      try {
        await saveSupabaseMaterial(docItem);
        // Optimistic update: show in list immediately
        setMaterials(prev => [docItem, ...prev]);

        showNotification(`Success: "${docItem.title}" has been shared directly with your peers!`);
        
        // Reset
        setQuickUploadFile(null);
        setQuickUploadTitle('');
        setQuickUploadIsUploading(false);
      } catch (innerErr: any) {
        console.error('[UPLOAD TRACE] Quick upload material save FAILED:', innerErr);
        throw innerErr;
      }
    } catch (err) {
      setQuickUploadIsUploading(false);
      handleFirestoreError(err, OperationType.CREATE, `materials/${matId}`);
    }
  };

  // Interactive Quizzes Game loop
  const handleStartQuiz = (subject: string) => {
    setQuizSubject(subject);
    setQuizStarted(true);
    setQuizCurrentIndex(0);
    setQuizSelectedOption(null);
    setQuizSubmitted(false);
    setQuizScore(0);
    setQuizTimer(15);
    showNotification(`Aptitude Quiz started for ${subject}. 15s per question.`);
    triggerQuizTimer();
  };

  const triggerQuizTimer = () => {
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    setQuizTimer(15);
    quizTimerRef.current = setInterval(() => {
      setQuizTimer(prev => {
        if (prev <= 1) {
          clearInterval(quizTimerRef.current);
          handleQuizSubmit(true); // Auto-fail/submit on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleQuizSubmit = (isTimeout = false) => {
    if (quizSubmitted) return;
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    setQuizSubmitted(true);

    const questions = MOCK_QUIZZES[quizSubject] || [];
    const question = questions[quizCurrentIndex];

    if (isTimeout) {
      showNotification('Time elapsed! Question marked incorrect.');
    } else if (quizSelectedOption === question.correctOptionIndex) {
      setQuizScore(prev => prev + 1);
      showNotification('Great job! Correct response.');
    } else {
      showNotification('Incorrect selection. Review explanation.');
    }
  };

  const handleNextQuizQuestion = () => {
    const questions = MOCK_QUIZZES[quizSubject] || [];
    if (quizCurrentIndex + 1 < questions.length) {
      setQuizCurrentIndex(prev => prev + 1);
      setQuizSelectedOption(null);
      setQuizSubmitted(false);
      triggerQuizTimer();
    } else {
      // End Quiz loop
      setQuizStarted(false);
      const pct = questions.length > 0 ? Math.round((quizScore / questions.length) * 100) : 0;
      awardStudentXP(currentUser, 'complete_quiz', { quizScorePercent: pct });
      showNotification(`Quiz Finished! Accuracy: ${quizScore}/${questions.length}.`);
    }
  };

  // Community Portal Operations
  const handleSendChat = async (overrideText?: string, materialIdId?: string) => {
    const textToSend = overrideText || newChatText;
    if (!textToSend.trim()) return;

    const msgId = Date.now().toString();
    const msg: ChatMessage = {
      id: msgId,
      name: currentUser?.name || 'Anonymous Peer',
      role: effectiveRole || 'student',
      house: currentUser?.house,
      message: textToSend.trim(),
      createdAt: new Date().toISOString(),
      targetId: activeChatTargetId || 'group-all',
      sharedMaterialId: materialIdId || undefined,
      ownerUid: currentUser?.uid || undefined
    };

    // Optimistic update — show message instantly for the sender
    setChats(prev => {
      if (prev.some(c => c.id === msg.id)) return prev;
      return [...prev, msg];
    });

    try {
      await savePeerMessage(msg);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'chat:send',
          chat: msg
        }));
      }
      if (!overrideText) {
        setNewChatText('');
      }
      setTimeout(() => {
        const scrollArea = document.getElementById('chat-scroll-view');
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
      }, 50);
    } catch (err: any) {
      console.error("Error sending peer message:", err);
    }
  };

  const handleShareMaterialToChat = async (mat: MaterialResource, targetRoomId: string) => {
    const text = `📁 Shared files: "${mat.title}" for subject ${mat.subject}`;
    const msgId = `${Date.now()}-share`;
    const msg: ChatMessage = {
      id: msgId,
      name: currentUser?.name || 'Anonymous Peer',
      role: effectiveRole || 'student',
      house: currentUser?.house,
      message: text,
      createdAt: new Date().toISOString(),
      targetId: targetRoomId,
      sharedMaterialId: mat.id,
      ownerUid: currentUser?.uid || undefined
    };

    try {
      await savePeerMessage(msg);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'chat:send',
          chat: msg
        }));
      }
      showNotification(`Successfully shared to chat!`);
    } catch (err: any) {
      console.error("Error sharing material to chat:", err);
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const roomId = `${newRoomType}-${Date.now()}`;
    const newRoom: ChatRoom = {
      id: roomId,
      name: newRoomName.trim(),
      type: newRoomType,
      icon: newRoomIcon,
      description: newRoomDescription.trim() || `Study room created for peers`,
      code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      creatorId: currentUser?.uid || 'unknown',
      members: [currentUser?.uid || 'unknown'],
      moderators: [currentUser?.uid || 'unknown']
    };

    const updated = [...chatRooms, newRoom];
    setChatRooms(updated);
    setActiveChatTargetId(roomId);
    
    saveChatRoom(newRoom).catch(error => {
      console.error("Error saving chat room:", error);
    });

    // reset form
    setNewRoomName('');
    setNewRoomType('group');
    setNewRoomIcon('💬');
    setNewRoomDescription('');
    setIsCreatingRoom(false);
    showNotification(`New ${newRoomType} "${newRoom.name}" has been created!`);
  };


  // Interactive Feedback Forum lists
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomCode.trim() || !currentUser) return;
    const code = joinRoomCode.trim().toUpperCase();
    
    try {
      const res = await joinChatRoom(code, currentUser.uid);
      if (res.success && res.room) {
        setChatRooms(prev => {
          if (prev.some(r => r.id === res.room!.id)) return prev;
          return [...prev, res.room!];
        });
        setActiveChatTargetId(res.room.id);
        setIsCreatingRoom(false);
        setJoinRoomCode('');
        showNotification(res.alreadyJoined ? `Already joined ${res.room.name}` : `Joined room: ${res.room.name}`);
      } else {
        showNotification(res.message || 'Invalid room code. Please check and try again.');
      }
    } catch (err) {
      console.error(err);
      showNotification('Failed to join room.');
    }
  };
  const handleAddFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedbackText.trim()) return;

    const postId = generateUniqueId();
    const post: FeedbackPost = {
      id: postId,
      author: currentUser?.name || 'Student OS Guest',
      role: effectiveRole || 'student',
      text: newFeedbackText.trim(),
      votes: 1,
      category: newFeedbackCategory,
      status: 'pending',
      createdAt: new Date().toISOString(),
      replies: []
    };

    setFeedbackPosts(prev => {
      const updated = [post, ...prev];
      saveFeedbacksToSupabase(updated);
      return updated;
    });
    setNewFeedbackText('');
    showNotification('Feedback posted directly to faculty bulletin boards.');
  };

  const upvoteFeedback = async (id: string) => {
    if (!currentUser) return;
    setFeedbackPosts(prev => {
      const updated = prev.map(p => {
        if (p.id === id) {
          const upvotedBy = p.upvotedBy || [];
          if (upvotedBy.includes(currentUser.uid)) {
            // Remove vote
            return { ...p, votes: p.votes - 1, upvotedBy: upvotedBy.filter(uid => uid !== currentUser.uid) };
          }
          return { ...p, votes: p.votes + 1, upvotedBy: [...upvotedBy, currentUser.uid] };
        }
        return p;
      });
      saveFeedbacksToSupabase(updated);
      return updated;
    });
  };
  const saveFeedbacksToSupabase = async (feedbacks: FeedbackPost[]) => {
    try {
      await supabase.from('global_data').upsert({
        id: '__global_feedbacks__',
        title: 'Global Feedbacks',
        subject: 'System',
        content: JSON.stringify(feedbacks),
        created_at: new Date().toISOString()
      });
      // Sync to other users via realtime
      if (socketRef.current) {
         socketRef.current.send(JSON.stringify({
            type: 'broadcast',
            event: 'feedbacks:updated',
            payload: { feedbacks }
         }));
      }
    } catch(e) {
      console.warn("Failed saving feedbacks to supabase", e);
    }
  };


  const handleFacultyStatusUpdate = async (id: string, nextStatus: 'in-progress' | 'solved' | 'planned') => {
    setFeedbackPosts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, status: nextStatus } : p);
      saveFeedbacksToSupabase(updated);
      return updated;
    });
    showNotification(`Feedback status updated to: ${nextStatus.toUpperCase()}`);
  };



  const readImageAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = () => reject(new Error('Image loader error.'));
      reader.readAsDataURL(file);
    });
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = () => reject(new Error('File reader error.'));
      reader.readAsDataURL(file);
    });
  };

  // File attachments and Thread state mutations
  // File attachments and Thread state mutations (strictly scoped to active thread, never touches user accounts)
  const handleFileUploadAction = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Guaranteed binding to active thread without affecting account state
    let targetThreadId = activeThreadId;
    if (!targetThreadId) {
      if (aiThreads.length > 0) {
        targetThreadId = aiThreads[0].id;
        setActiveThreadId(targetThreadId);
      } else {
        targetThreadId = generateUniqueId();
        setActiveThreadId(targetThreadId);
        setAiThreads([{
          id: targetThreadId,
          title: 'Study Session with Attached Document',
          personaId: selectedPersona || 'study_buddy',
          mode: aiMode || 'explanatory',
          messages: []
        }]);
      }
    }

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Limit file size to 15MB
        if (file.size > 15 * 1024 * 1024) {
          showNotification(`❌ File too large: "${file.name}" limits exceeded.`);
          continue;
        }
        
        showNotification(`Scanning attachment: "${file.name}"...`);
        
        try {
          const extracted = await extractAttachmentContent(file);
          if (extracted.extractionError) {
            showNotification(`❌ PDF could not be read: "${file.name}". ${extracted.extractionError}`);
            continue;
          }

          if (extracted.wasRenderedFromScannedPdf) {
            showNotification('This PDF has no text layer. Reading it as images.');
          } else {
            showNotification(`✓ File linked perfectly: "${file.name}"`);
          }

          const itemsToAttach = (extracted.imageChunks && extracted.imageChunks.length > 0)
            ? extracted.imageChunks.map(chk => ({
                name: chk.name,
                size: Math.round(file.size / extracted.imageChunks!.length),
                type: 'image/png',
                content: chk.dataUrl,
                base64Data: chk.cleanBase64,
                mimeType: 'image/png',
                isImage: true,
                wasRenderedFromScannedPdf: true
              }))
            : [{
                name: extracted.name,
                size: extracted.size,
                type: extracted.type,
                content: extracted.content,
                base64Data: extracted.base64Data,
                mimeType: extracted.mimeType,
                isImage: extracted.isImage,
                wasRenderedFromScannedPdf: extracted.wasRenderedFromScannedPdf
              }];

          setAttachedFiles(prev => {
            const updated = [...prev, ...itemsToAttach];
            setAiThreads(threads => threads.map(t => {
              if (t.id === targetThreadId) {
                return { ...t, attachedFiles: updated, attachedFile: itemsToAttach[0] };
              }
              return t;
            }));
            return updated;
          });
        } catch (err: any) {
          showNotification(`❌ PDF could not be read: "${file.name}".`);
        }
      }
    } finally {
      setTimeout(() => {
        (window as any).__studentos_file_picker_active__ = false;
      }, 1000);
      e.target.value = '';
    }
  };

  const handleRemoveAttachedFile = (fileName: string) => {
    setAttachedFiles(prev => {
      const updated = prev.filter(f => f.name !== fileName);
      setAiThreads(threads => threads.map(t => {
        if (t.id === activeThreadId) {
          return { ...t, attachedFiles: updated, attachedFile: updated[0] || null };
        }
        return t;
      }));
      return updated;
    });
    showNotification(`Removed: "${fileName}"`);
  };

  const handleCreateNewThread = () => {
    const newId = generateUniqueId();
    const newThread = {
      id: newId,
      title: `Study Session #${aiThreads.length + 1}`,
      personaId: selectedPersona,
      mode: aiMode,
      messages: [
        { role: 'assistant' as const, content: "Start a brand-new discussion segment. Choose a learning mode option or upload references to guide our exploration!" }
      ],
      attachedFile: null,
      attachedFiles: [],
      userId: currentUser?.uid || '',
      createdAt: Date.now()
    };
    if (currentUser?.uid) {
      saveAiBuddyChat(newThread as any).catch(error => {
        console.error("Error saving AI buddy chat:", error);
      });
    }
    setAiThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newId);
    setAttachedFiles([]);
    showNotification('New study thread initialized!');
  };

  const handleSwitchPersona = (personaId: string) => {
    setSelectedPersona(personaId);
    if (currentUser?.uid) {
       const t = aiThreads.find(t => t.id === activeThreadId);
       if (t) {
         saveAiBuddyChat({ 
           ...t, 
           personaId, 
           title: `Study with ${AI_PERSONAS.find(p => p.id === personaId)?.name || 'Tutor'}`,
           userId: currentUser?.uid || "" 
         } as any).catch(error => {
           console.error("Error saving AI buddy chat persona:", error);
         });
       }
    }
    showNotification(`Active Mentor switched: ${AI_PERSONAS.find(p => p.id === personaId)?.name}`);
  };

  const handleSwitchMode = (mode: 'explanatory' | 'socratic' | 'coder' | 'quiz_gen') => {
    setAiMode(mode);
    if (currentUser?.uid) {
       const t = aiThreads.find(t => t.id === activeThreadId);
       if (t) {
         saveAiBuddyChat({ 
           ...t, 
           mode,
           userId: currentUser?.uid || "" 
         } as any).catch(error => {
           console.error("Error saving AI buddy chat mode:", error);
         });
       }
    }
    showNotification(`Active mode set to ${mode.toUpperCase()}`);
  };

  const handleDeleteThread = (threadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (aiThreads.length <= 1) {
      showNotification('At least one chat sequence must remain intact.');
      return;
    }
    if (currentUser?.uid) {
      deleteAiBuddyChat(threadId, currentUser.uid).catch(error => {
        console.error("Error deleting AI buddy chat:", error);
      });
    }
    const nextThreads = aiThreads.filter(t => t.id !== threadId);
    setAiThreads(nextThreads);
    
    if (activeThreadId === threadId && nextThreads.length > 0) {
      const fallbackThread = nextThreads[0];
      setActiveThreadId(fallbackThread.id);
      setSelectedPersona(fallbackThread.personaId);
      setAiMode(fallbackThread.mode);
      if (fallbackThread.attachedFiles) {
        setAttachedFiles(fallbackThread.attachedFiles);
      } else if (fallbackThread.attachedFile) {
        setAttachedFiles([fallbackThread.attachedFile]);
      } else {
        setAttachedFiles([]);
      }
    }
    showNotification('Chat thread discarded.');
    setAiThreadHoldMenu(null);
  };

  const handleClearThreadHistory = () => {
    setAiThreads(prev => prev.map(t => {
      if (t.id === activeThreadId) {
        const clearedThread = {
          ...t,
          messages: [
            { role: 'assistant' as const, content: "Conversation segment cleared by user." }
          ],
          attachedFile: null,
          attachedFiles: []
        };
        if (currentUser?.uid) {
          saveAiBuddyChat({ ...clearedThread, userId: currentUser.uid } as any).catch(console.error);
        }
        return clearedThread;
      }
      return t;
    }));
    setAttachedFiles([]);
    showNotification('Conversation record flushed.');
  };

  const handleLeaveRoom = async (roomId: string) => {
    if (!roomId || !currentUser?.uid) return;
    try {
      await leaveChatRoom(roomId, currentUser.uid);
      setChatRooms(prev => prev.filter(r => r.id !== roomId));
      if (activeChatTargetId === roomId) {
        setActiveChatTargetId('group-all');
      }
      showNotification('Left chat room');
    } catch (err) {
      console.error("Error leaving chat room:", err);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!roomId || !currentUser?.uid) return;
    try {
      await deleteChatRoom(roomId, currentUser.uid);
      setChatRooms(prev => prev.filter(r => r.id !== roomId));
      if (activeChatTargetId === roomId) {
        setActiveChatTargetId('group-all');
      }
      showNotification('Room deleted successfully');
    } catch (err) {
      console.error("Error deleting chat room:", err);
    }
  };

  const handleDeletePeerMessage = async (messageId: string) => {
    if (!messageId) return;
    try {
      await deletePeerMessage(messageId);
      setChats(prev => prev.filter(c => c.id !== messageId));
      showNotification('Message deleted');
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('Response copied to clipboard!');
  };

  const handleSaveToNotes = (text: string) => {
    const cleanSubject = currentUser?.specialtySubject || 'AI Study';
    const defaultTitle = text.length > 30 ? text.substring(0, 30).trim() + "..." : text;
    const title = prompt("Enter a title for this note:", `AI Mentor - ${defaultTitle}`);
    if (title === null) return; // User cancelled prompt
    
    const finalTitle = title.trim() || `AI Study Note - ${new Date().toLocaleDateString()}`;
    const newNote: VaultNote = {
      id: generateUniqueId(),
      title: finalTitle,
      subject: cleanSubject,
      content: text,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
    
    setVaultNotes(prev => [newNote, ...prev]);
    showNotification('Saved to your Personal Vault Notes!');
  };

  const handleToggleSpeakMessage = (text: string, msgKey: string) => {
    if (!('speechSynthesis' in window)) {
      showNotification('TTS is not supported in this browser.');
      return;
    }
    
    if (window.speechSynthesis.speaking && speakingMsgIdx === msgKey) {
      window.speechSynthesis.cancel();
      setSpeakingMsgIdx(null);
      showNotification('Audio output paused.');
    } else {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const cleanText = text.replace(/[#*_`]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05;
        utterance.onend = () => {
          setSpeakingMsgIdx(null);
        };
        utterance.onerror = () => {
          setSpeakingMsgIdx(null);
        };
        setSpeakingMsgIdx(msgKey);
        window.speechSynthesis.speak(utterance);
        showNotification('Speaking reply aloud...');
      }, 50);
    }
  };

  // Secure AI Teacher dialog queries proxying via our server endpoints with real-time token streaming
  const handleAskAIModel = async (overrideQuery?: string | React.MouseEvent) => {
    const rawQueryText = typeof overrideQuery === 'string' ? overrideQuery : aiInput;
    if (!rawQueryText.trim() || aiLoading) return;

    const userRoleKey = (effectiveRole || currentUser?.role || 'student').toLowerCase();
    const userIdKey = currentUser?.uid || currentUser?.email || 'guest';

    // 1. Quota Pre-Check
    const currentUsage = getLocalUsageState(userIdKey, userRoleKey);
    if (currentUsage.remaining <= 0) {
      showNotification(`Daily AI Buddy limit reached (${currentUsage.limit}/${currentUsage.limit}). Upgrade quota or redeem a voucher.`);
      setShowQuotaModal(true);
      return;
    }
    
    const userQuery = rawQueryText.trim();
    const currentAttachedFiles = [...attachedFiles];
    const newUserMsg = { 
      role: 'user' as const, 
      content: userQuery,
      files: currentAttachedFiles
    };

    // Separate image attachments for real multimodal parts from document text
    const imagePayload = currentAttachedFiles
      .filter((file: any) => file.isImage || (file.type && file.type.startsWith('image/')) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name))
      .map((file: any) => ({
        name: file.name,
        mimeType: file.mimeType || file.type || 'image/jpeg',
        data: (file.base64Data || (typeof file.content === 'string' ? file.content.replace(/^data:[^;]+;base64,/, '') : '')).trim()
      }))
      .filter(img => img.data && img.data.length > 0);
    
    let promptWithContext = userQuery;
    if (currentAttachedFiles.length > 0) {
      const fileContextString = currentAttachedFiles.map((file: any) => {
        if (file.isImage || (file.type && file.type.startsWith('image/')) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
          return `[Attached Diagram/Image: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`;
        } else if (file.extractionError) {
          return `[Attached Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]
Status: The file content could not be read (${file.extractionError}).`;
        } else {
          let safeDocText = String(file.content || '').trim();
          if (safeDocText.length > 15000) {
            safeDocText = safeDocText.slice(0, 15000) + '\n\n[...Remainder of document text truncated for performance...]';
          }
          return `[Attached Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]
Content from ${file.name}:
"""
${safeDocText}
"""`;
        }
      }).join('\n\n');
      
      let roleLabel = 'Student Inquiry';
      if (currentUser?.role) {
         roleLabel = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) + ' Inquiry';
      }
      
      const fileNamesList = currentAttachedFiles.map(f => `"${f.name}"`).join(', ');
      promptWithContext = `${fileContextString}

${roleLabel}: ${userQuery}

[Directive: The student attached the following file(s): ${fileNamesList}. You MUST explicitly mention the file name(s) (${fileNamesList}) in your response to demonstrate that the document content was reviewed.]`;
    }

    const targetThreadId = activeThreadId;
    const currentThread = aiThreads.find(t => t.id === targetThreadId) || aiThreads[0];
    
    const updatedMessages = [...(currentThread?.messages || []), newUserMsg];
    const newTitle = currentThread.title.startsWith('Study Session #') || currentThread.title.startsWith('Introductory Study') || currentThread.title.startsWith('Study with')
      ? (userQuery.length > 25 ? userQuery.substring(0, 25) + '...' : userQuery)
      : currentThread.title;

    // Optimistically push user message + streaming assistant placeholder
    setAiThreads(prev => prev.map(t => {
      if (t.id === targetThreadId) {
        return { 
          ...t, 
          messages: [...updatedMessages, { role: 'assistant' as const, content: '' }],
          title: newTitle,
          attachedFiles: []
        };
      }
      return t;
    }));

    if (typeof overrideQuery !== 'string') {
      setAiInput('');
    }
    setAttachedFiles([]);
    setAiLoading(true);

    // Prepare AbortController for user cancelation
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    aiAbortControllerRef.current = abortCtrl;

    try {
      let answer = '';
      // Fetch role-authorized StudentOS context ONLY when query asks about StudentOS data
      const { contextString: ragContext, hasStudentOSData } = await buildAuthorizedStudentOSContext(
        userQuery,
        currentUser,
        userRoleKey
      );
      setAiGroundedInData(hasStudentOSData);

      const historyPayload = (currentThread?.messages || []).slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      let streamedWebSources: any[] = [];
      let streamedWebUsed = false;
      setAiStatusMessage(aiWebSearchMode === 'force' ? '🔍 Searching verified web & academic sources...' : '');

      const streamResult = await streamAIChatClient(
        {
          prompt: promptWithContext,
          history: historyPayload,
          persona: selectedPersona,
          level: currentUser?.grade,
          subject: currentUser?.specialtySubject || 'Science',
          mode: aiMode,
          ragContext: ragContext || undefined,
          userId: userIdKey,
          userRole: userRoleKey,
          modelOverride: aiModelOverride || undefined,
          webSearchMode: aiWebSearchMode,
          images: imagePayload.length > 0 ? imagePayload : undefined
        },
        {
          signal: abortCtrl.signal,
          onStatus: (statusMeta) => {
            if (statusMeta.message) setAiStatusMessage(statusMeta.message);
          },
          onStart: (meta) => {
            setAiStatusMessage('');
            if (meta.model) setAiActiveModelLabel(meta.model);
            if (meta.webSearchUsed) streamedWebUsed = true;
            if (Array.isArray(meta.webSources) && meta.webSources.length > 0) {
              streamedWebSources = meta.webSources;
            }
          },
          onToken: (_delta, fullText) => {
            answer = fullText;
            setAiThreads(prev => prev.map(t => {
              if (t.id === targetThreadId) {
                return {
                  ...t,
                  messages: [
                    ...updatedMessages,
                    {
                      role: 'assistant' as const,
                      content: fullText,
                      webSearchUsed: streamedWebUsed,
                      webSources: streamedWebSources
                    }
                  ]
                };
              }
              return t;
            }));
          },
          onDone: (finalMeta) => {
            setAiStatusMessage('');
            if (finalMeta.model) setAiActiveModelLabel(finalMeta.model);
            if (finalMeta.webSearchUsed) streamedWebUsed = true;
            if (Array.isArray(finalMeta.webSources) && finalMeta.webSources.length > 0) {
              streamedWebSources = finalMeta.webSources;
            }
          }
        }
      );

      answer = streamResult.text || answer || 'I encountered an issue processing your lesson topic.';
      if (streamResult.model) setAiActiveModelLabel(streamResult.model);
      const finalWebUsed = Boolean(streamResult.webSearchUsed || streamedWebUsed);
      const finalWebSources = (streamResult.webSources && streamResult.webSources.length > 0)
        ? streamResult.webSources
        : streamedWebSources;
      awardStudentXP(currentUser, 'use_ai_study');

      if (streamResult.usage) {
        setAiUsageState(prev => ({
          ...prev,
          used: streamResult.usage.used,
          limit: streamResult.usage.limit,
          remaining: streamResult.usage.remaining,
          nextAvailableInMinutes: streamResult.usage.nextAvailableInMinutes,
          lastUpdated: Date.now()
        }));
      } else {
        const updated = recordLocalMessage(userIdKey, userRoleKey);
        setAiUsageState(updated);
      }

      setAiThreads(prev => prev.map(t => {
        if (t.id === targetThreadId) {
          return {
            ...t,
            messages: [
              ...updatedMessages,
              {
                role: 'assistant',
                content: answer,
                webSearchUsed: finalWebUsed,
                webSources: finalWebSources
              }
            ]
          };
        }
        return t;
      }));

      if (currentUser?.uid) {
         saveAiBuddyChat({ 
           ...currentThread, 
           id: targetThreadId,
           userId: currentUser?.uid || "",
           title: newTitle,
           messages: [
             ...updatedMessages,
             {
               role: 'assistant',
               content: answer,
               webSearchUsed: finalWebUsed,
               webSources: finalWebSources
             }
           ] 
         } as any).catch(error => {
           console.error("Error saving AI buddy chat response:", error);
         });
      }

      if (ttsEnabled) {
        speakText(answer);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        showNotification('Generation stopped.');
        return;
      }
      const isQuotaErr = err?.isLimitReached || err?.message?.includes('Daily AI message limit') || err?.message?.includes('AI_LIMIT_REACHED');
      if (isQuotaErr) {
        setAiUsageState(prev => ({
          ...prev,
          remaining: 0,
          used: prev.limit,
          nextAvailableInMinutes: err?.limitData?.nextAvailableInMinutes || 60
        }));
        setShowQuotaModal(true);
      }
      const errorContent = isQuotaErr
        ? `⚠️ **Daily AI Buddy Limit Reached**\n\nYou have used your daily query allocation for your tier (${aiUsageState.limit} queries/day). \n\n* **Replenishment**: Queries reset on a rolling 24-hour cycle.\n* **Instant Boost**: Click **"Upgrade Quota"** above to enter an academic study voucher (e.g. \`STUDENTOS-PRO\` or \`EXAM-PREP\`) or request an extra quota grant from your instructors.`
        : `⚠️ **AI is temporarily unavailable**\n\n${err?.message || 'Please try again in a moment.'}`;

      setAiThreads(prev => prev.map(t => {
        if (t.id === targetThreadId) {
          return { 
            ...t, 
            messages: [...updatedMessages, { role: 'assistant' as const, content: errorContent }] 
          };
        }
        return t;
      }));
    } finally {
      setAiLoading(false);
      aiAbortControllerRef.current = null;
      setTimeout(() => {
        const dialogBox = document.getElementById('ai-dialog-scroll');
        if (dialogBox) dialogBox.scrollTop = dialogBox.scrollHeight;
      }, 50);
    }
  };

  // Select dynamic accent colors based on House profile
  const getHouseAccentClass = () => {
    if (!currentUser || effectiveRole === 'teacher') return 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10 focus:ring-indigo-500';
    switch (currentUser.house) {
      case 'Ruby': return 'border-red-500/30 text-red-400 bg-red-500/10 focus:ring-red-500';
      case 'Emerald': return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 focus:ring-emerald-500';
      case 'Sapphire': return 'border-blue-500/30 text-blue-400 bg-blue-500/10 focus:ring-blue-500';
      case 'Topaz': return 'border-amber-500/30 text-amber-500 bg-amber-500/10 focus:ring-amber-500';
      default: return 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10 focus:ring-indigo-500';
    }
  };

  const getHousePrimaryText = () => {
    if (!currentUser || effectiveRole === 'teacher') return 'text-indigo-400';
    switch (currentUser.house) {
      case 'Ruby': return 'text-red-400 font-bold';
      case 'Emerald': return 'text-emerald-400 font-bold';
      case 'Sapphire': return 'text-blue-400 font-bold';
      case 'Topaz': return 'text-amber-500 font-bold';
      default: return 'text-indigo-400';
    }
  };

  const getHouseBadgeColor = (house: HouseType) => {
    switch (house) {
      case 'Ruby': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'Emerald': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'Sapphire': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'Topaz': return 'bg-amber-500/20 text-amber-500 border border-amber-500/30';
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${lightMode ? 'bg-slate-50 text-slate-800' : 'bg-slate-950 text-slate-100'}`}>
      
      {/* 🔒 Screen Lock Screen Overlay */}
      {isLocked && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-2xl flex flex-col items-center justify-center z-[200] animate-fadeIn select-none p-4">
          <div className="max-w-md w-full px-6 text-center space-y-6">
            <div className="mx-auto h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl flex items-center justify-center text-2xl shadow-xl animate-bounce">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">Workspace Locked</h2>
              <p className="text-xs text-slate-400">Classroom Safety Guard Active. Enter PIN to unlock.</p>
            </div>

            {/* PIN Keypad vs Password / Recovery Key Switcher */}
            {useKeyMode ? (
              <div className="space-y-4 max-w-[320px] mx-auto pt-2">
                <div className="space-y-2 text-left">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Security Password / Recovery Key
                  </label>
                  <input
                    type="password"
                    value={lockScreenPinInput}
                    onChange={(e) => {
                      setLockScreenPinInput(e.target.value);
                      setLockScreenError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUnlockWithPin();
                      }
                    }}
                    placeholder="Enter password or paste recovery hash"
                    className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white font-mono placeholder-slate-600 transition-all"
                    autoFocus
                  />
                </div>

                {lockScreenError && (
                  <p className="text-xs text-red-400 font-semibold animate-pulse">{lockScreenError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUseKeyMode(false);
                      setLockScreenPinInput('');
                      setLockScreenError('');
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-all cursor-pointer"
                  >
                    🔢 Keypad
                  </button>
                  <button
                    type="button"
                    disabled={isUnlocking}
                    onClick={handleUnlockWithPin}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all flex items-center justify-center cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {isUnlocking ? <RefreshCw className="w-4 h-4 animate-spin text-slate-950" /> : 'Unlock'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Hidden Input field for keyboard users and visible indicator dots */}
                <div className="space-y-4">
                  <input
                    type="password"
                    value={lockScreenPinInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.length > 6) {
                        setLockScreenPinInput(val);
                        setUseKeyMode(true);
                      } else {
                        const clean = val.replace(/[^0-9]/g, '');
                        setLockScreenPinInput(clean);
                      }
                      setLockScreenError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUnlockWithPin();
                      }
                    }}
                    className="sr-only"
                    autoFocus
                    aria-label="Enter Security PIN"
                  />

                  <div className="flex justify-center gap-3">
                    {Array.from({ length: Math.max(4, lockScreenPinInput.length) }).slice(0, 6).map((_, i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                          lockScreenPinInput.length > i
                            ? 'bg-indigo-500 border-indigo-400 scale-110 shadow-lg shadow-indigo-500/50'
                            : 'bg-transparent border-slate-700'
                        }`}
                      />
                    ))}
                  </div>

                  {lockScreenError && (
                    <p className="text-xs text-red-400 font-semibold animate-pulse">{lockScreenError}</p>
                  )}
                </div>

                {/* Smart Touch Numeric Keypad */}
                <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto pt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        if (lockScreenPinInput.length < 6) {
                          setLockScreenPinInput(prev => prev + num.toString());
                          setLockScreenError('');
                        }
                      }}
                      className="h-14 w-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 text-white text-lg font-bold transition-all flex items-center justify-center border border-white/5 cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setLockScreenPinInput('');
                      setLockScreenError('');
                    }}
                    className="h-14 w-14 rounded-2xl bg-red-500/10 hover:bg-red-500/20 active:scale-95 text-red-400 text-xs font-bold transition-all flex items-center justify-center border border-red-500/10 cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (lockScreenPinInput.length < 6) {
                        setLockScreenPinInput(prev => prev + '0');
                        setLockScreenError('');
                      }
                    }}
                    className="h-14 w-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 text-white text-lg font-bold transition-all flex items-center justify-center border border-white/5 cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={isUnlocking}
                    onClick={handleUnlockWithPin}
                    className="h-14 w-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs transition-all flex items-center justify-center cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {isUnlocking ? <RefreshCw className="w-4 h-4 animate-spin text-slate-950" /> : 'Enter'}
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUseKeyMode(true);
                      setLockScreenError('');
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
                  >
                    🔑 Unlock with Password or Recovery Key
                  </button>
                </div>
              </>
            )}

            <p className="text-[10px] text-slate-500 uppercase tracking-widest pt-2">
              Secure Classroom Smart Board Session
            </p>
          </div>
        </div>
      )}

      {/* 📝 Teacher PIN Setup / Modification Modal */}
      {pinSetupOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[250] animate-fadeIn p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full mx-auto space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="font-bold text-sm text-indigo-400">🛡️ Classroom PIN Setup</span>
              <button
                type="button"
                onClick={() => {
                  setPinSetupOpen(false);
                  setNewPin('');
                  setConfirmPin('');
                  setCurrentPinInput('');
                  setPinError('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <p className="text-slate-400">
                {hasPinConfigured
                  ? 'Update your 4 or 6-digit workspace PIN. Requires current PIN for security.'
                  : 'Create a 4 or 6-digit PIN to securely lock your workspace and protect classroom privacy.'}
              </p>
            </div>

            <div className="space-y-3 pt-2 text-left">
              {hasPinConfigured && (
                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-bold">Current PIN or Recovery Key</label>
                  <input
                    type="password"
                    value={currentPinInput}
                    onChange={(e) => {
                      setCurrentPinInput(e.target.value.trim());
                    }}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-center text-sm tracking-wider font-mono focus:border-indigo-500 outline-none text-white"
                    placeholder="Enter PIN or recovery key"
                    autoFocus
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400 font-bold">New Security PIN</label>
                <input
                  type="password"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                    setNewPin(cleanVal);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-center text-lg tracking-widest font-black focus:border-indigo-500 outline-none"
                  placeholder="••••"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400 font-bold">Confirm New PIN</label>
                <input
                  type="password"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                    setConfirmPin(cleanVal);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-center text-lg tracking-widest font-black focus:border-indigo-500 outline-none"
                  placeholder="••••"
                />
              </div>

              {pinError && (
                <p className="text-xs text-red-400 font-bold text-center">{pinError}</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPinSetupOpen(false);
                  setNewPin('');
                  setConfirmPin('');
                  setCurrentPinInput('');
                  setPinError('');
                }}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingPin}
                onClick={handleSavePin}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white transition-all shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSavingPin ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (hasPinConfigured ? 'Update PIN' : 'Save PIN')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔑 PIN Verification / Authorization Modal */}
      {pinVerifyOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[250] animate-fadeIn p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full mx-auto space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="font-bold text-sm text-amber-400">🔑 Security Authorization</span>
              <button
                type="button"
                onClick={() => {
                  setPinVerifyOpen(false);
                  setVerifyPinInput('');
                  setPinVerifyAction(null);
                  setPinError('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-center">
              <p className="text-xs text-slate-400">
                Please enter your security PIN to authorize this sensitive action.
              </p>
            </div>

            <div className="pt-2 text-center">
              <input
                type="password"
                value={verifyPinInput}
                onChange={(e) => {
                  setVerifyPinInput(e.target.value.trim());
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleVerifyPin();
                  }
                }}
                className="w-full max-w-[240px] mx-auto px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-center text-sm tracking-wider font-mono focus:border-amber-500 outline-none text-white"
                placeholder="PIN or recovery key"
                autoFocus
              />

              {pinError && (
                <p className="text-xs text-red-400 font-bold mt-2">{pinError}</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPinVerifyOpen(false);
                  setVerifyPinInput('');
                  setPinVerifyAction(null);
                  setPinError('');
                }}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVerifyingPin}
                onClick={handleVerifyPin}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isVerifyingPin ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" /> : 'Authorize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ Classroom Security Dialog Modal (Portal-backed, Responsive) */}
      <SecurityDialog
        isOpen={securityMenuOpen}
        onClose={() => setSecurityMenuOpen(false)}
        isLocked={isLocked}
        hasPinConfigured={hasPinConfigured}
        isLoading={isSecurityChecking}
        presentationMode={presentationMode}
        onTogglePresentationMode={() => {
          if (presentationMode) {
            triggerPinVerification(() => {
              setPresentationMode(false);
              localStorage.setItem('s_os_presentation_mode', 'false');
              showNotification('🔓 Presentation Mode disabled. Normal views restored.');
            });
          } else {
            if (!hasPinConfigured) {
              setSecurityMenuOpen(false);
              setPinSetupOpen(true);
            } else {
              setPresentationMode(true);
              localStorage.setItem('s_os_presentation_mode', 'true');
              if (!isTabAllowedInPresentation(activeTab)) {
                setActiveTab('whiteboard');
              }
              showNotification('🔒 Presentation Mode active on Smart Board.');
            }
          }
        }}
        autoLockTime={autoLockTime}
        onChangeAutoLockTime={(minutes) => {
          setAutoLockTime(minutes);
          localStorage.setItem('s_os_auto_lock_time', minutes.toString());
          showNotification(minutes > 0 ? `⏰ Screen will auto-lock after ${minutes} minutes of inactivity.` : '⏰ Auto-lock disabled.');
        }}
        onOpenPinSetup={() => setPinSetupOpen(true)}
        onLockWorkspace={handleLockWorkspace}
        isLocking={isLockingWorkspace}
        statusError={securityStatusError}
      />
      
      {/* Startup Screen — Quantum Neural Boot Experience */}
      {(showStartup || (!currentUser && (firebaseLoading || dataLoading))) && (
        <div className="fixed inset-0 bg-[#030712] flex flex-col justify-between z-[100] transition-opacity duration-700 select-none overflow-hidden p-4 sm:p-8">
          {/* Architectural Perspective Grid & Deep Cosmic Auroras */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.06)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,#030712_85%)] pointer-events-none" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-indigo-600/15 rounded-full blur-[130px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[420px] h-[420px] bg-cyan-500/10 rounded-full blur-[110px] pointer-events-none animate-pulse" style={{ animationDuration: '5s' }} />

          {/* Top Telemetry Bar */}
          <div className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-slate-400 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-slate-200 font-bold">STUDENTOS QUANTUM CORE</span>
              <span className="hidden sm:inline text-slate-600">·</span>
              <span className="hidden sm:inline text-indigo-400">ENCRYPTED TELEMETRY LINK</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline text-slate-500">BUILD v{APP_VERSION}</span>
              <button
                type="button"
                onClick={() => {
                  setFirebaseLoading(false);
                  setDataLoading(false);
                  setShowStartup(false);
                  try { sessionStorage.setItem('s_os_startup_shown', 'true'); } catch (_) {}
                }}
                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/40 text-slate-300 hover:text-white font-bold transition-all cursor-pointer"
              >
                Skip Boot →
              </button>
            </div>
          </div>

          {/* Centerpiece Quantum Reactor + 4-Subsystem Matrix */}
          <div className="max-w-3xl w-full mx-auto my-auto py-4 text-center space-y-7 relative z-10">
            {/* Orbital HUD & Emblem */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center">
                {/* Ambient Core Glow */}
                <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-indigo-500/30 via-cyan-400/20 to-emerald-400/20 blur-2xl animate-pulse" />

                {/* SVG Multi-Ring Orbital Progress Reactor */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 160 160">
                  {/* Outer Decorative Dashed Orbit */}
                  <circle
                    cx="80"
                    cy="80"
                    r="74"
                    fill="none"
                    stroke="rgba(99, 102, 241, 0.2)"
                    strokeWidth="1"
                    strokeDasharray="4 6"
                  />
                  {/* Background Track Ring */}
                  <circle
                    cx="80"
                    cy="80"
                    r="64"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.06)"
                    strokeWidth="4"
                  />
                  {/* Dynamic Progress Ring */}
                  <circle
                    cx="80"
                    cy="80"
                    r="64"
                    fill="none"
                    stroke="url(#studentos-boot-grad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={402}
                    strokeDashoffset={402 - (402 * Math.min(100, Math.max(5, loadingProgress))) / 100}
                    className="transition-all duration-150 ease-out"
                  />
                  <defs>
                    <linearGradient id="studentos-boot-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="50%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Counter-rotating inner orbital ring */}
                <div className="absolute inset-5 rounded-full border border-cyan-400/20 border-t-cyan-400/80 animate-spin" style={{ animationDuration: '6s' }} />

                {/* Central Emblem Core */}
                <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-[2rem] bg-gradient-to-br from-indigo-500 via-cyan-500 to-emerald-400 p-[2px] shadow-2xl shadow-indigo-500/40">
                  <div className="w-full h-full bg-slate-950 rounded-[30px] flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
                    <BrandLogo size={48} className="relative z-10" />
                    <span className="text-[10px] font-mono font-black text-cyan-300 tracking-wider mt-1.5 relative z-10">
                      {loadingProgress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Brand Title & Subtitle - Centered */}
              <div className="space-y-2 flex flex-col items-center">
                <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-400/80">
                  <span>UNIFIED ACADEMIC ECOSYSTEM</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black font-brand tracking-tighter text-white">
                  {BRAND_CONFIG.name.toUpperCase()}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500 max-w-xs mx-auto font-medium tracking-wide">
                   Smartboards · Orion AI Tutors · Scholar XP
                </p>
              </div>
            </div>

            {/* 4-Stage Subsystem Diagnostic Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-left">
              {[
                {
                  idx: 0,
                  title: 'Identity Node',
                  sub: 'OAuth2 & Role Matrix',
                  metric: '256-BIT',
                  threshold: 20,
                  icon: '🛡️'
                },
                {
                  idx: 1,
                  title: 'Orion AI Core',
                  sub: 'Neural Tutor Engine',
                  metric: 'NVIDIA NIM',
                  threshold: 45,
                  icon: '🧠'
                },
                {
                  idx: 2,
                  title: 'Realtime Sync',
                  sub: 'Live Push & Channels',
                  metric: 'WSS LIVE',
                  threshold: 70,
                  icon: '⚡'
                },
                {
                  idx: 3,
                  title: 'Scholar Arena',
                  sub: 'SM-2 & Gamification',
                  metric: 'READY',
                  threshold: 92,
                  icon: '🏆'
                }
              ].map((mod) => {
                const isComplete = loadingProgress >= mod.threshold;
                const isActive = !isComplete && loadingStep === mod.idx;
                return (
                  <div
                    key={mod.title}
                    className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-300 backdrop-blur-md ${
                      isComplete
                        ? 'bg-emerald-950/25 border-emerald-500/35 shadow-lg shadow-emerald-500/5'
                        : isActive
                        ? 'bg-indigo-950/40 border-indigo-400/50 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-900/40 border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base">{mod.icon}</span>
                      <span
                        className={`text-[9px] font-mono font-extrabold uppercase tracking-wider ${
                          isComplete
                            ? 'text-emerald-400'
                            : isActive
                            ? 'text-cyan-300 animate-pulse'
                            : 'text-slate-500'
                        }`}
                      >
                        {isComplete ? '✓ ONLINE' : isActive ? 'BOOTING...' : mod.metric}
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-white truncate">{mod.title}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{mod.sub}</p>
                  </div>
                );
              })}
            </div>

            {/* Master Progress Console */}
            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                  <p className="text-xs sm:text-sm text-slate-200 font-mono font-bold truncate">
                    {STARTUP_MESSAGES[loadingStep] || 'Optimizing workspace parameters...'}
                  </p>
                </div>
                <span className="text-sm sm:text-base font-mono font-black text-cyan-300 tabular-nums shrink-0">
                  {loadingProgress}%
                </span>
              </div>

              {/* Liquid Gradient Progress Bar */}
              <div className="w-full bg-slate-950 border border-white/10 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-100 ease-out relative"
                  style={{ width: `${Math.max(4, loadingProgress)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 tracking-wider uppercase">
                <span>STATUS: {loadingProgress >= 100 ? 'WORKSPACE READY' : 'SYNCHRONIZING MODULES'}</span>
                <span>LATENCY: 14ms · TLS 1.3</span>
              </div>
            </div>
          </div>

          {/* Bottom Footer Bar */}
          <div className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5 pt-3">
            <span>REMIX STUDENTOS INSTITUTIONAL SUITE</span>
            <span className="text-slate-400">ALL SYSTEMS NOMINAL</span>
          </div>
        </div>
      )}

      {/* Absolute Dynamic Alert Center */}

      {/* Onboarding Authentication Modal Gate — Compact Single-Viewport Layout */}
      {!currentUser && !firebaseLoading && !dataLoading && (
        <div id="onboarding-gate-modal" className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-5 safe-area-pt safe-area-pb relative">
          <BackgroundBeams />
          <div className="bento-card max-w-md w-full rounded-3xl border border-white/10 shadow-2xl p-5 sm:p-6 space-y-4 relative overflow-hidden z-10">
            <BorderBeam size={220} duration={12} colorFrom="#6366f1" colorTo="#38bdf8" />
            {/* Compact Brand Header - Centered Layout */}
            <div className="flex flex-col items-center justify-center gap-2 border-b border-white/10 pb-4 text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                <BrandLogo size={56} className="relative z-10" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <h1 className="text-2xl font-black font-brand tracking-tight text-white uppercase">
                    {BRAND_CONFIG.name}
                  </h1>
                  <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">v{APP_VERSION}</span>
                </div>
                <p className="text-xs text-slate-400 font-medium tracking-wide">
                  Academic & Institutional Workspace
                </p>
              </div>
            </div>

            {/* Sign In / Create Account Segmented Switcher */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900/90 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  soundService.playButtonClick();
                  setRegStep('login');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  regStep === 'login'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                id="start-signup-flow-btn"
                type="button"
                onClick={() => {
                  soundService.playButtonClick();
                  if (regStep === 'login') {
                    setRegStep('role');
                    setIsGoogleLinked(false);
                    setLinkedGoogleUid(null);
                    setLinkedGooglePhoto(null);
                    setRegName('');
                    setRegEmail('');
                  }
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  regStep !== 'login'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Compact Step Indicator for Sign-Up */}
            {regStep !== 'login' && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                {[
                  { key: 'role', step: 1, label: '1. Role' },
                  { key: 'profile', step: 2, label: '2. Details' },
                  { key: 'submit', step: 3, label: '3. Confirm' }
                ].map((s, idx) => {
                  const currentIdx = regStep === 'role' ? 1 : regStep === 'profile' ? 2 : 3;
                  const isDone = currentIdx > s.step;
                  const isCurrent = currentIdx === s.step;
                  return (
                    <React.Fragment key={s.key}>
                      <span
                        className={`font-semibold ${
                          isCurrent ? 'text-indigo-400 font-bold' : isDone ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {isDone ? `✓ ${s.label}` : s.label}
                      </span>
                      {idx < 2 && <span className="text-slate-700">·</span>}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            <AnimatePresence mode="wait">
              {regStep === 'login' && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  id="reg-step-login"
                  className="space-y-3.5"
                >
                  {/* Google Sign-In */}
                  <div className="flex items-center gap-2">
                    <button
                      id="google-signin-btn"
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs transition-colors shadow-sm cursor-pointer"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.6a5.64 5.64 0 0 1-2.45 3.7v2.51h3.95c2.31-2.13 3.64-5.26 3.64-9.06Z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.95-2.51a7.21 7.21 0 0 1-11.02-3.8H.92v2.59A12 12 0 0 0 12 24Z" />
                        <path fill="#FBBC05" d="M4.96 14.78A7.16 7.16 0 0 1 4.5 12c0-.98.17-1.92.46-2.78V6.63H.92A12 12 0 0 0 .92 17.37l4.04-2.59Z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A12.012 12.012 0 0 0 .92 6.63l4.04 2.59a7.2 7.2 0 0 1 7.04-4.47Z" />
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                    <button
                      id="google-signin-select-btn"
                      type="button"
                      onClick={handleGoogleSignInWithSelect}
                      className="py-2.5 px-3 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-white/10 transition-colors shrink-0 cursor-pointer"
                      title="Choose another Google account"
                    >
                      Switch
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[11px] text-slate-500 font-medium">or sign in with email</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  {/* Email & Password Form */}
                  <form onSubmit={handleEmailSignIn} className="space-y-3 text-left">
                    <div>
                      <label htmlFor="login-email-input" className="block text-xs font-semibold text-slate-300 mb-1">
                        School Email
                      </label>
                      <input
                        id="login-email-input"
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="scholar@academy.edu"
                        className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 focus:outline-none focus:border-indigo-500 text-white placeholder-slate-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="login-password-input" className="text-xs font-semibold text-slate-300">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="login-password-input"
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full text-xs sm:text-sm pl-3.5 pr-16 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 focus:outline-none focus:border-indigo-500 text-white placeholder-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                        >
                          {showLoginPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    {authError && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-left flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-200 leading-snug">{authError.message}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={firebaseLoading}
                      className="uiverse-btn-primary w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {firebaseLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                  </form>

                  {/* Compact Saved Profiles Strip */}
                  {recentAccounts.length > 0 && (
                    <div id="recent-accounts-section" className="pt-2.5 border-t border-white/10 space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 block text-left">
                        Saved accounts on this device
                      </span>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                        {recentAccounts.slice(0, 3).map((acc) => (
                          <div
                            key={acc.uid || acc.email}
                            className="p-2 rounded-xl bg-slate-900/70 border border-white/5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-bold text-white truncate">
                                {acc.name} <span className="text-[10px] font-normal text-indigo-300">· {acc.role}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{acc.email}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleContinueRecentAccount(acc)}
                                className="py-1 px-2.5 text-[11px] font-bold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 rounded-lg transition-colors cursor-pointer"
                              >
                                Resume
                              </button>
                              <button
                                type="button"
                                title="Remove saved account"
                                onClick={() => handleRemoveRecentAccount(acc.email)}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* PASSWORD RESET SCREEN */}
              {regStep === 'reset-password' && (
                <motion.div
                  key="reset-password"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="space-y-4 text-left"
                >
                  <div className="flex items-center gap-3 pb-1">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Security Update</h3>
                      <p className="text-[10px] text-slate-400">Establish a secure new account credential.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                        New Passcode
                      </label>
                      <input
                        type="password"
                        required
                        value={newResetPassword}
                        onChange={(e) => setNewResetPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full text-xs px-3.5 py-3 rounded-xl bg-slate-900/90 border border-white/10 focus:outline-none focus:border-indigo-500 text-white placeholder-slate-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                        Confirm Passcode
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmResetPassword}
                        onChange={(e) => setConfirmResetPassword(e.target.value)}
                        placeholder="Verify your new password"
                        className="w-full text-xs px-3.5 py-3 rounded-xl bg-slate-900/90 border border-white/10 focus:outline-none focus:border-indigo-500 text-white placeholder-slate-600 transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleConfirmResetPassword}
                      disabled={isResettingPassword || !newResetPassword || newResetPassword !== confirmResetPassword || newResetPassword.length < 6}
                      className="uiverse-btn-primary w-full py-3 px-4 rounded-xl text-white font-bold text-xs transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20 active:scale-[0.98] cursor-pointer"
                    >
                      {isResettingPassword ? 'Updating Vault...' : 'Apply Security Update'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setRegStep('login')}
                      className="w-full mt-3 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Abort & Back to Sign In
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 1: ROLE SELECTION */}
              {regStep === 'role' && (
                <motion.div
                  key="role"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  id="reg-step-role"
                  className="space-y-3"
                >
                  <p className="text-xs text-slate-300 text-left">
                    Select your primary role in the school workspace:
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { type: 'student', icon: '🎓', label: 'Student', desc: 'Classes, AI Tutor & Homework' },
                      { type: 'teacher', icon: '👩‍🏫', label: 'Teacher', desc: 'Classes, Grading & Smartboard' },
                      { type: 'coordinator', icon: '🧭', label: 'Coordinator', desc: 'Schedules & Department Wing' },
                      { type: 'admin', icon: '⚙️', label: 'Admin', desc: 'School Management & Approvals' }
                    ].map((item) => {
                      const selected = regRole === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setRegRole(item.type as any)}
                          className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                            selected
                              ? 'bg-indigo-600/20 border-indigo-400 text-white shadow-sm'
                              : 'bg-slate-900/60 border-white/10 text-slate-300 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-lg">{item.icon}</span>
                            {selected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                          </div>
                          <div className="font-bold text-xs text-white mt-1.5">{item.label}</div>
                          <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{item.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setRegStep('login')}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                    >
                      ← Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegStep('profile')}
                      className="uiverse-btn-primary px-5 py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer"
                    >
                      Continue as {regRole.charAt(0).toUpperCase() + regRole.slice(1)} →
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: COMPACT PROFILE FORM */}
              {regStep === 'profile' && (
                <motion.form
                  key="profile"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  id="reg-step-profile"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      regNameError ||
                      regPhoneError ||
                      regBirthdateError ||
                      !regName ||
                      !regPhone ||
                      !regBirthdate ||
                      !regEmail
                    ) {
                      return;
                    }
                    setRegStep('submit');
                  }}
                  className="space-y-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white capitalize">{regRole} Profile Details</span>
                    <button
                      type="button"
                      onClick={handleLinkGoogle}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        isGoogleLinked
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-white text-slate-950 hover:bg-slate-100 border-white'
                      }`}
                    >
                      {isGoogleLinked ? '✓ Google Linked' : 'Auto-Fill with Google'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegName(val);
                          if (val && !/^[A-Za-z\s]+$/.test(val)) {
                            setRegNameError('Letters and spaces only');
                          } else {
                            setRegNameError('');
                          }
                        }}
                        placeholder="Aryan Sharma"
                        className={`w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border ${
                          regNameError ? 'border-rose-500' : 'border-white/10 focus:border-indigo-500'
                        } focus:outline-none text-white`}
                      />
                      {regNameError && <p className="text-rose-400 text-[10px] mt-0.5">{regNameError}</p>}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">School Email *</label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="scholar@academy.edu"
                        className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 focus:outline-none focus:border-indigo-500 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Phone *</label>
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegPhone(val);
                          if (val && !/^[+0-9\-\s()]+$/.test(val)) {
                            setRegPhoneError('Invalid phone format');
                          } else {
                            setRegPhoneError('');
                          }
                        }}
                        placeholder="+91 98765 43210"
                        className={`w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border ${
                          regPhoneError ? 'border-rose-500' : 'border-white/10 focus:border-indigo-500'
                        } focus:outline-none text-white`}
                      />
                      {regPhoneError && <p className="text-rose-400 text-[10px] mt-0.5">{regPhoneError}</p>}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Birthdate *</label>
                      <input
                        type="date"
                        required
                        value={regBirthdate}
                        onChange={(e) => {
                          setRegBirthdate(e.target.value);
                          if (e.target.value && new Date(e.target.value) > new Date()) {
                            setRegBirthdateError('Cannot be in the future');
                          } else {
                            setRegBirthdateError('');
                          }
                        }}
                        className={`w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border ${
                          regBirthdateError ? 'border-rose-500' : 'border-white/10 focus:border-indigo-500'
                        } focus:outline-none text-white`}
                      />
                      {regBirthdateError && <p className="text-rose-400 text-[10px] mt-0.5">{regBirthdateError}</p>}
                    </div>
                  </div>

                  {!isGoogleLinked && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                        Password * (Min 6 characters)
                      </label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 focus:outline-none focus:border-indigo-500 text-white"
                      />
                    </div>
                  )}

                  {regRole === 'student' && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Grade</label>
                        <select
                          value={regGrade}
                          onChange={(e) => setRegGrade(e.target.value)}
                          className="w-full text-xs px-2.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
                        >
                          {Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`).map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Section</label>
                        <select
                          value={regSection}
                          onChange={(e) => setRegSection(e.target.value)}
                          className="w-full text-xs px-2.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
                        >
                          <option value="Astra">Astra</option>
                          <option value="Elara">Elara</option>
                          <option value="Solara">Solara</option>
                          <option value="Vega">Vega</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">House</label>
                        <select
                          value={regHouse}
                          onChange={(e) => setRegHouse(e.target.value)}
                          className="w-full text-xs px-2.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
                        >
                          <option value="Ruby">Ruby</option>
                          <option value="Emerald">Emerald</option>
                          <option value="Sapphire">Sapphire</option>
                          <option value="Topaz">Topaz</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {regRole === 'teacher' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Department *</label>
                        <input
                          type="text"
                          required
                          value={regDept}
                          onChange={(e) => setRegDept(e.target.value)}
                          placeholder="Sciences"
                          className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Subjects *</label>
                        <input
                          type="text"
                          required
                          value={regSubjects}
                          onChange={(e) => setRegSubjects(e.target.value)}
                          placeholder="Physics, Math"
                          className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
                        />
                      </div>
                    </div>
                  )}

                  {regRole === 'coordinator' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Managed Department / Wing *</label>
                      <input
                        type="text"
                        required
                        value={regDept}
                        onChange={(e) => setRegDept(e.target.value)}
                        placeholder="Senior Secondary Wing"
                        className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
                      />
                    </div>
                  )}

                  {regRole === 'admin' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Official Designation *</label>
                      <input
                        type="text"
                        required
                        value={regDesignation}
                        onChange={(e) => setRegDesignation(e.target.value)}
                        placeholder="Principal / Administrator"
                        className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
                      />
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setRegStep('role')}
                      className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={!!regNameError || !!regPhoneError || !!regBirthdateError}
                      className="uiverse-btn-primary px-5 py-2.5 rounded-xl text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                    >
                      Review →
                    </button>
                  </div>
                </motion.form>
              )}

              {/* STEP 3: SUBMIT REGISTRATION */}
              {regStep === 'submit' && (
                <motion.div
                  key="submit"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  id="reg-step-submit"
                  className="space-y-3 text-left"
                >
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Role</span>
                      <span className="font-bold text-indigo-300 capitalize">{regRole}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Name</span>
                      <span className="font-bold text-white truncate">{regName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Email</span>
                      <span className="font-mono text-slate-200 truncate max-w-[200px]">{regEmail}</span>
                    </div>
                    {regRole === 'student' && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Placement</span>
                        <span className="font-semibold text-white">{regGrade} · {regSection} · {regHouse}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug">
                    Student accounts activate immediately. Staff roles are queued for school administrator verification.
                  </p>

                  <div className="flex justify-between items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setRegStep('profile')}
                      className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                    >
                      ← Edit
                    </button>
                    <button
                      id="submit-onboarding-btn"
                      type="button"
                      onClick={handleOnboardingLogin}
                      className="uiverse-btn-primary px-5 py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer"
                    >
                      Create Account & Enter →
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Compact Security & Privacy Footer */}
            <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-500">
              <span>🔒 Protected by school-isolated RLS</span>
              <span>Authorized Institutional Access</span>
            </div>
          </div>
        </div>
      )}

      {currentUser && !isLocked && (
        <div className="flex min-h-screen relative">
          {(getSavedTheme() === 'halloween' || currentUser.raw_data?.theme === 'halloween') && (
            <>
              <div className="halloween-fog-overlay" />
              <div className="halloween-bat-anim">🦇</div>
            </>
          )}
          
          {/* Sidebar Overlay (Closes sidebar on outside click for Mobile/Tablet) */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main Workspace Sidebar */}
          <aside
            aria-label="Primary Workspace Navigation"
            className={`fixed top-0 left-0 h-dvh bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border-r border-white/10 z-50 flex flex-col justify-between transition-all duration-300 safe-area-pt safe-area-pb ${
              sidebarOpen
                ? 'w-[min(268px,calc(100vw-2rem))] sm:w-64 p-3.5 sm:p-4 translate-x-0 shadow-2xl'
                : 'w-0 -translate-x-full overflow-hidden p-0 md:w-20 md:p-3 md:translate-x-0 md:overflow-visible'
            }`}
          >
            {/* Sidebar Header Brand & Collapse Controls */}
            <div className="shrink-0 pb-4 border-b border-white/10">
              <div className={`flex flex-col items-center justify-center text-center ${sidebarOpen ? 'space-y-3' : 'space-y-2'}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (!sidebarOpen) setSidebarOpen(true);
                    else handleTabSelect('dashboard');
                  }}
                  className={`rounded-2xl flex items-center justify-center transition-all active:scale-90 cursor-pointer overflow-hidden shadow-lg ${
                    sidebarOpen 
                      ? 'h-16 w-16 bg-gradient-to-br from-indigo-500 to-purple-600 p-[1.5px]' 
                      : 'h-10 w-10 bg-slate-800 hover:bg-slate-700'
                  }`}
                  title={sidebarOpen ? `${BRAND_CONFIG.name} Dashboard` : `Expand ${BRAND_CONFIG.name} Sidebar`}
                >
                  <div className={`w-full h-full flex items-center justify-center ${sidebarOpen ? 'bg-slate-950 rounded-[14px]' : ''}`}>
                    <BrandLogo size={sidebarOpen ? 40 : 28} />
                  </div>
                </button>
                
                {sidebarOpen && (
                  <div className="flex flex-col items-center">
                    <span className="text-base font-black font-brand text-white tracking-widest uppercase">
                      {BRAND_CONFIG.name}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono tracking-tighter mt-0.5">
                      INSTITUTIONAL SUITE v{APP_VERSION}
                    </span>
                  </div>
                )}
              </div>

                {sidebarOpen ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(false)}
                      className="hidden md:flex p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Collapse sidebar to icon rail"
                      aria-label="Collapse sidebar"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(false)}
                      className="md:hidden p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      aria-label="Close navigation menu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="hidden md:flex mt-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Expand sidebar"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Module Search Filter & Top Drop-down Profile Switcher (when expanded) */}
              {sidebarOpen && (
                <div className="space-y-2">
                  <div className="relative">
                    <select
                      value={
                        (() => {
                          const list = getAvailableSwitchAccounts();
                          const byUid = list.find(a => a.uid === currentUser.uid);
                          if (byUid) return byUid.uid;
                          const byEmailAndRole = list.find(a => a.email.toLowerCase() === (currentUser.email || '').toLowerCase() && a.role === currentUser.role);
                          if (byEmailAndRole) return byEmailAndRole.uid;
                          const byRole = list.find(a => a.role === currentUser.role);
                          return byRole ? byRole.uid : (currentUser.uid || 'demo-super');
                        })()
                      }
                      onChange={(e) => {
                        handleSwitchProfileAccount(e.target.value);
                      }}
                      className="w-full bg-slate-900 border border-white/10 hover:border-indigo-500/50 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none cursor-pointer appearance-none transition-all shadow-inner truncate pr-7"
                      title="Switch active profile account & sync user data"
                    >
                      {getAvailableSwitchAccounts().map(acc => (
                        <option key={acc.uid} value={acc.uid} className="bg-slate-900 text-white font-medium py-1">
                          {acc.role === 'student' ? '🎓' : acc.role === 'teacher' ? '🔬' : acc.role === 'parent' ? '🛡️' : acc.role === 'super_admin' ? '👑' : '⚡'} {acc.name} ({acc.role.replace('_', ' ')})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={sidebarSearchQuery}
                      onChange={e => setSidebarSearchQuery(e.target.value)}
                      placeholder="Filter navigation..."
                      className="w-full pl-8 pr-7 py-1.5 bg-slate-950/90 rounded-xl border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    {sidebarSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSidebarSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                        aria-label="Clear filter"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            
            {/* Scrollable Navigation Body */}
            <nav className="flex-1 min-h-0 overflow-y-auto py-3 pr-1 space-y-4 scrollbar-thin">
              {(() => {
                const q = sidebarSearchQuery.trim().toLowerCase();
                const matchesFilter = (label: string, keywords: string = '') => {
                  if (!q) return true;
                  return label.toLowerCase().includes(q) || keywords.toLowerCase().includes(q);
                };

                return (
                  <>
                    {/* ORION COPILOT BUTTON — GLOBAL FOR ALL ROLES */}
                    {matchesFilter('Orion AI Copilot Assistant', 'orion ai copilot voice assistant 3d') && (
                      <div className="pb-1">
                        <button
                          type="button"
                          onClick={() => setIsJarvisActive(true)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-indigo-600/35 via-violet-600/35 to-teal-600/25 hover:from-indigo-600/60 hover:to-teal-600/50 text-white border border-indigo-400/40 shadow-lg shadow-indigo-500/15 transition-all cursor-pointer group"
                          title="Open Orion AI Copilot & School Assistant"
                        >
                          <div className="w-5 h-5 rounded-lg bg-indigo-500/30 border border-indigo-300/50 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform shrink-0">
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                          </div>
                          {sidebarOpen && (
                            <div className="flex items-center justify-between flex-1 min-w-0">
                              <span className="truncate font-black tracking-wider text-white">Orion</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 font-mono font-extrabold uppercase">3D</span>
                            </div>
                          )}
                        </button>
                      </div>
                    )}

                    {/* SECTION 1: STUDY SUITE */}
                    <div className="space-y-1">
                      {sidebarOpen && (
                        <button
                          type="button"
                          onClick={() => toggleSidebarSection('study')}
                          className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          <span>Study Suite</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              collapsedSidebarSections['study'] ? '-rotate-90' : ''
                            }`}
                          />
                        </button>
                      )}

                      {(!collapsedSidebarSections['study'] || !sidebarOpen || q.length > 0) && (
                        <div className="space-y-1">
                          {!presentationMode && matchesFilter('Dashboard Overview', 'home summary stats') && (
                            <button
                              type="button"
                              onClick={() => handleTabSelect('dashboard')}
                              className={getSidebarBtnClass('dashboard')}
                              title="Dashboard Overview"
                            >
                              <LayoutDashboard className="w-4 h-4 shrink-0" />
                              {sidebarOpen && <span className="truncate">Dashboard</span>}
                            </button>
                          )}


                          {(!presentationMode || isTabAllowedInPresentation('study_hub')) &&
                            matchesFilter('Study Hub Flashcards Tasks Planner', 'spaced repetition sm2 cards study center') && (
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() => handleTabSelect('study_hub')}
                                  className={getSidebarBtnClass('study_hub')}
                                  title="Study Hub: Flashcards, Tasks & Study Planner"
                                >
                                  <Layers className="w-4 h-4 shrink-0" />
                                  {sidebarOpen && (
                                    <div className="flex items-center justify-between flex-1 min-w-0">
                                      <span className="truncate">Study Hub</span>
                                      {dueCardsCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-200 font-mono font-bold text-[10px] leading-none">
                                          {dueCardsCount} due
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {!sidebarOpen && dueCardsCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
                                  )}
                                </button>

                                {/* Direct Sub-navigation for Flashcards, Tasks, and Planner when Study Hub is active or searched */}
                                {sidebarOpen &&
                                  (['study_hub', 'tasks', 'planner', 'flashcards'].includes(activeTab) || q.length > 0) && (
                                    <div className="pl-6 pr-1 py-1 space-y-1 border-l border-white/10 ml-4">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStudyHubSubTab('flashcards');
                                          handleTabSelect('study_hub');
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                          ['study_hub', 'flashcards'].includes(activeTab) && studyHubSubTab === 'flashcards'
                                            ? 'bg-indigo-500/20 text-indigo-200 font-semibold'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                      >
                                        <span>Study Flashcards</span>
                                        {dueCardsCount > 0 && (
                                          <span className="text-[10px] font-mono text-rose-400 font-bold">
                                            {dueCardsCount}
                                          </span>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStudyHubSubTab('tasks');
                                          handleTabSelect('study_hub');
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                          ['study_hub', 'tasks'].includes(activeTab) && studyHubSubTab === 'tasks'
                                            ? 'bg-indigo-500/20 text-indigo-200 font-semibold'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                      >
                                        <span>Tasks & Objectives</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStudyHubSubTab('planner');
                                          handleTabSelect('study_hub');
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                          ['study_hub', 'planner'].includes(activeTab) && studyHubSubTab === 'planner'
                                            ? 'bg-indigo-500/20 text-indigo-200 font-semibold'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                      >
                                        <span>Schedule Planner</span>
                                      </button>
                                    </div>
                                  )}
                              </div>
                            )}

                          {!presentationMode && !isSportsTeacher && matchesFilter('Lecture Notes', 'vault collaborative markdown') && (
                            <button
                              type="button"
                              onClick={() => handleTabSelect('notes')}
                              className={getSidebarBtnClass('notes')}
                              title="Lecture Notes"
                            >
                              <FileText className="w-4 h-4 shrink-0" />
                              {sidebarOpen && <span className="truncate">Lecture Notes</span>}
                            </button>
                          )}

                          {(!presentationMode || isTabAllowedInPresentation('calendar')) &&
                            matchesFilter('Academic Calendar', 'schedule events dates exams') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('calendar')}
                                className={getSidebarBtnClass('calendar')}
                                title="Academic Calendar"
                              >
                                <Calendar className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Academic Calendar</span>}
                              </button>
                            )}

                          {(!presentationMode || isTabAllowedInPresentation('pomodoro')) &&
                            matchesFilter('Focus Timer', 'pomodoro study clock') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('pomodoro')}
                                className={getSidebarBtnClass('pomodoro')}
                                title="Focus Timer"
                              >
                                <Clock className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Focus Timer</span>}
                              </button>
                            )}
                        </div>
                      )}
                    </div>

                    {/* SECTION 2: CLASSROOM & LEARNING */}
                    <div className="space-y-1">
                      {sidebarOpen && (
                        <button
                          type="button"
                          onClick={() => toggleSidebarSection('classroom')}
                          className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          <span>Classroom & Learning</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              collapsedSidebarSections['classroom'] ? '-rotate-90' : ''
                            }`}
                          />
                        </button>
                      )}

                      {(!collapsedSidebarSections['classroom'] || !sidebarOpen || q.length > 0) && (
                        <div className="space-y-1">
                          {(!presentationMode || isTabAllowedInPresentation('whiteboard')) &&
                            !isSportsTeacher &&
                            matchesFilter('Class Whiteboard', 'drawing board canvas 3d models') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('whiteboard')}
                                className={getSidebarBtnClass('whiteboard')}
                                title="Class Whiteboard"
                              >
                                <PenTool className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Class Whiteboard</span>}
                              </button>
                            )}

                          {(!presentationMode || isTabAllowedInPresentation('panel_board')) &&
                            matchesFilter('Panel Board', 'smart panel display projector classroom interactive touch') && (
                              <button
                                type="button"
                                onClick={handleOpenPanelBoard}
                                className={isPanelBoardOpen ? 'group relative w-full flex items-center transition-all duration-200 rounded-xl border text-left min-w-0 cursor-pointer bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border-indigo-500/50 gap-3 px-3 py-2.5' : getSidebarBtnClass('panel_board')}
                                title="Panel Board Mode"
                              >
                                <Tv className="w-4 h-4 shrink-0 text-cyan-400" />
                                {sidebarOpen && <span className="truncate">Panel Board</span>}
                              </button>
                            )}

                          {(!presentationMode || isTabAllowedInPresentation('ai_teacher')) &&
                            matchesFilter('Byte Chat', 'tutor assistant buddy byte') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('ai_teacher')}
                                className={getSidebarBtnClass('ai_teacher')}
                                title="Byte Chat"
                              >
                                <Brain className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Byte Chat</span>}
                              </button>
                            )}

                          {(!presentationMode || isTabAllowedInPresentation('materials')) &&
                            matchesFilter('Materials Hub', 'resources files pdfs library') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('materials')}
                                className={getSidebarBtnClass('materials')}
                                title="Materials Hub"
                              >
                                <BookOpen className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Materials Hub</span>}
                              </button>
                            )}

                          {(!presentationMode || isTabAllowedInPresentation('assignments')) &&
                            matchesFilter('Assignment Center', 'submissions grading') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('assignments')}
                                className={getSidebarBtnClass('assignments')}
                                title="Assignment Center"
                              >
                                <CheckSquare className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Assignment Center</span>}
                              </button>
                            )}

                          {(!presentationMode || isTabAllowedInPresentation('homework')) &&
                            !isSportsTeacher &&
                            matchesFilter('Class Homework', 'daily homework tasks') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('homework')}
                                className={getSidebarBtnClass('homework')}
                                title="Class Homework"
                              >
                                <ClipboardList className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Class Homework</span>}
                              </button>
                            )}

                          {!presentationMode && matchesFilter('Brain Battle', 'quiz game arena daily challenge multiplayer leaderboard xp') && (
                            <button
                              type="button"
                              onClick={() => handleTabSelect('brain_battle')}
                              className={getSidebarBtnClass('brain_battle')}
                              title="Brain Battle"
                            >
                              <Trophy className="w-4 h-4 shrink-0 text-amber-400" />
                              {sidebarOpen && <span className="truncate">Brain Battle</span>}
                            </button>
                          )}

                          {(!presentationMode || isTabAllowedInPresentation('meet')) &&
                            matchesFilter('Veylentra Meet', 'video call virtual classroom') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('meet')}
                                className={getSidebarBtnClass('meet')}
                                title="Veylentra Meet"
                              >
                                <Video className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Veylentra Meet</span>}
                              </button>
                            )}
                        </div>
                      )}
                    </div>

                    {/* SECTION 3: CAMPUS & COMMUNITY */}
                    {!presentationMode && (
                      <div className="space-y-1">
                        {sidebarOpen && (
                          <button
                            type="button"
                            onClick={() => toggleSidebarSection('community')}
                            className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            <span>Campus & Community</span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                collapsedSidebarSections['community'] ? '-rotate-90' : ''
                              }`}
                            />
                          </button>
                        )}

                        {(!collapsedSidebarSections['community'] || !sidebarOpen || q.length > 0) && (
                          <div className="space-y-1">
                            {matchesFilter('Global Chat', 'messages rooms peer chat') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('peer_chat')}
                                className={getSidebarBtnClass('peer_chat')}
                                title="Global Chat"
                              >
                                <MessageSquare className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Global Chat</span>}
                              </button>
                            )}

                            {matchesFilter('House Standings', 'championship points leaderboard') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('houses')}
                                className={getSidebarBtnClass('houses')}
                                title="House Standings"
                              >
                                <Award className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">House Standings</span>}
                              </button>
                            )}

                            {matchesFilter('Veylentra Life', 'competitions clubs events polls badges') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('life')}
                                className={getSidebarBtnClass('life')}
                                title="Veylentra Life: Competitions, Clubs, Events & Polls"
                              >
                                <Compass className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Veylentra Life</span>}
                              </button>
                            )}

                            {isSportsTeacher && matchesFilter('Sports & Activities', 'athletics clubs pe') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('sports_activities')}
                                className={getSidebarBtnClass('sports_activities')}
                                title="Sports & Activities"
                              >
                                <Activity className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Sports & Activities</span>}
                              </button>
                            )}

                            {matchesFilter('Blogs', 'articles publications') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('blogs')}
                                className={getSidebarBtnClass('blogs')}
                                title="Educational Blogs"
                              >
                                <Globe className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Blogs</span>}
                              </button>
                            )}

                            {matchesFilter('Feedback Board', 'suggestions ideas') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('feedback')}
                                className={getSidebarBtnClass('feedback')}
                                title="Feedback Board"
                              >
                                <Send className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Feedback Board</span>}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* SECTION 4: WORKSPACE & ADMINISTRATION */}
                    {!presentationMode && (
                      <div className="space-y-1">
                        {sidebarOpen && (
                          <button
                            type="button"
                            onClick={() => toggleSidebarSection('system')}
                            className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            <span>Workspace & Account</span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                collapsedSidebarSections['system'] ? '-rotate-90' : ''
                              }`}
                            />
                          </button>
                        )}

                        {(!collapsedSidebarSections['system'] || !sidebarOpen || q.length > 0) && (
                          <div className="space-y-1">
                            {matchesFilter('Performance Analytics', 'reports grades stats') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('analytics')}
                                className={getSidebarBtnClass('analytics')}
                                title="Performance Analytics"
                              >
                                <BarChart2 className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Analytics</span>}
                              </button>
                            )}

                            {matchesFilter('Substitute Board', 'teacher duty cover') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('substitutes')}
                                className={getSidebarBtnClass('substitutes')}
                                title="Substitute Board"
                              >
                                <RefreshCw className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Substitute Board</span>}
                              </button>
                            )}

                            {matchesFilter('Profile Settings', 'account user preferences') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('profile')}
                                className={getSidebarBtnClass('profile')}
                                title="My Profile & Preferences"
                              >
                                <User className="w-4 h-4 shrink-0" />
                                {sidebarOpen && (
                                  <span className="truncate">
                                    {(effectiveRole || 'student')
                                      .split(',')
                                      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                                      .join('')}{' '}
                                    Profile
                                  </span>
                                )}
                              </button>
                            )}

                            {matchesFilter('Parental Portal', 'parent guardian monitoring reports') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('parent_portal')}
                                className={getSidebarBtnClass('parent_portal')}
                                title="Parental Portal"
                              >
                                <Shield className="w-4 h-4 shrink-0 text-violet-400" />
                                {sidebarOpen && <span className="truncate">Parental Portal</span>}
                              </button>
                            )}

                            {matchesFilter("What's New", 'updates changelog releases') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('whats_new')}
                                className={getSidebarBtnClass('whats_new')}
                                title="What's New in Veylentra"
                              >
                                <Zap className="w-4 h-4 shrink-0" />
                                {sidebarOpen && (
                                  <div className="flex items-center justify-between flex-1 min-w-0">
                                    <span className="truncate">What's New</span>
                                    {whatsNewUnreadCount > 0 && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white font-mono font-bold text-[10px] leading-none">
                                        {whatsNewUnreadCount}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {!sidebarOpen && whatsNewUnreadCount > 0 && (
                                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
                                )}
                              </button>
                            )}

                            {effectiveRole === 'teacher' && matchesFilter('Faculty Center', 'teacher dashboard classes') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('faculty')}
                                className={getSidebarBtnClass('faculty', 'faculty')}
                                title="Faculty Center"
                              >
                                <GraduationCap className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span className="truncate">Faculty Center</span>}
                              </button>
                            )}

                            {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '') &&
                              matchesFilter('Attendance Manager', 'roll call register') && (
                                <button
                                  type="button"
                                  onClick={() => handleTabSelect('attendance_manager')}
                                  className={getSidebarBtnClass('attendance_manager', 'attendance')}
                                  title="Attendance Manager"
                                >
                                  <CheckCircle className="w-4 h-4 shrink-0" />
                                  {sidebarOpen && <span className="truncate">Attendance Manager</span>}
                                </button>
                              )}

                            {(effectiveRole === 'admin' || effectiveRole === 'super_admin') &&
                              matchesFilter('Admin Center', 'super admin requests management') && (
                                <button
                                  type="button"
                                  onClick={() => handleTabSelect('admin')}
                                  className={getSidebarBtnClass('admin', 'admin')}
                                  title="Admin Center"
                                >
                                  <Shield className="w-4 h-4 shrink-0" />
                                  {sidebarOpen && <span className="truncate">Admin Center</span>}
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </nav>

            {/* Sidebar Footer User Detail & Actions */}
            <div className="shrink-0 pt-3 border-t border-white/10 space-y-2.5">
              {sidebarOpen ? (
                <button
                  type="button"
                  onClick={() => handleTabSelect('profile')}
                  className="w-full p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 text-left transition-colors cursor-pointer"
                  title="Open Profile Settings"
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      className="h-9 w-9 rounded-xl object-cover border border-white/10 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${
                        currentUser.house ? getHouseBadgeColor(currentUser.house) : 'bg-slate-700'
                      }`}
                    >
                      {currentUser.name ? currentUser.name[0] : '?'}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-white truncate leading-tight">
                      {currentUser.name || 'Veylentra User'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                      {presentationMode ? 'Presenter Mode' : getUserProfileTitle(currentUser, effectiveRole)}
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTabSelect('profile')}
                  className="w-full flex items-center justify-center p-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  title={`${currentUser.name || 'User'} — ${getUserProfileTitle(currentUser, effectiveRole)}`}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      className="h-8 w-8 rounded-xl object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs text-white ${
                        currentUser.house ? getHouseBadgeColor(currentUser.house) : 'bg-slate-700'
                      }`}
                    >
                      {currentUser.name ? currentUser.name[0] : '?'}
                    </div>
                  )}
                </button>
              )}

              {sidebarOpen ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-300 border border-rose-500/20 rounded-xl transition-all font-semibold cursor-pointer"
                  title="Sign out of Veylentra"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span className="truncate">Sign Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center p-2 text-xs bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-400 rounded-xl transition-all font-semibold cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}

              {/* Absolute Bottom Sidebar Button: About Veylentra */}
              {sidebarOpen ? (
                <button
                  type="button"
                  onClick={() => handleTabSelect('about')}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'about'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/10 bg-white/5 border border-white/5'
                  }`}
                  title="About Veylentra"
                >
                  <Info className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'about' ? 'text-white' : 'text-indigo-400'}`} />
                  <span className="truncate">About Veylentra</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTabSelect('about')}
                  className={`w-full flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                    activeTab === 'about'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/10 bg-white/5'
                  }`}
                  title="About Veylentra"
                >
                  <Info className={`w-4 h-4 ${activeTab === 'about' ? 'text-white' : 'text-indigo-400'}`} />
                </button>
              )}
            </div>
          </aside>

          {/* Main workspace frame */}
          <div className={`flex-1 flex flex-col min-h-screen min-w-0 max-w-full transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
            {/* BEAUTIFUL DEMO MODE BANNER */}
            {isDemoMode && (
              <div className="bg-gradient-to-r from-red-600 via-amber-600 to-indigo-600 text-white py-2 px-4 shadow-lg z-50 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded animate-pulse">🚨 DEMO ACTIVE</span>
                  <span className="text-xs font-semibold text-white/90">Sandbox state loaded. Real-time Firestore paused.</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] uppercase font-black text-white/70 tracking-wider">Switch Profile:</span>
                  <button
                    onClick={() => handleSwitchProfileAccount('demo-student-uid')}
                    className={`text-[9px] font-extrabold py-0.5 px-2 rounded transition-all ${currentUser?.uid === 'demo-student-uid' ? 'bg-white text-slate-900 border border-white font-black shadow-sm scale-105' : 'bg-black/25 text-white border border-white/10 hover:bg-black/45'}`}
                  >
                    🎓 Aarav (Student)
                  </button>
                  <button
                    onClick={() => handleSwitchProfileAccount('demo-teacher-uid')}
                    className={`text-[9px] font-extrabold py-0.5 px-2 rounded transition-all ${currentUser?.uid === 'demo-teacher-uid' ? 'bg-white text-slate-900 border border-white font-black shadow-sm scale-105' : 'bg-black/25 text-white border border-white/10 hover:bg-black/45'}`}
                  >
                    🔬 Prof. Elara (Teacher)
                  </button>
                  <button
                    onClick={() => handleSwitchProfileAccount('demo-admin-uid')}
                    className={`text-[9px] font-extrabold py-0.5 px-2 rounded transition-all ${currentUser?.uid === 'demo-admin-uid' ? 'bg-white text-slate-900 border border-white font-black shadow-sm scale-105' : 'bg-black/25 text-white border border-white/10 hover:bg-black/45'}`}
                  >
                    🛡️ Admin
                  </button>
                </div>
              </div>
            )}
            
            {/* Live Broadcast Banner */}
            <LiveBroadcastBanner currentUser={currentUser} />

            {/* Global Workspace Header bar */}
            <header className="sticky top-0 z-40 px-2 sm:px-6 py-2 sm:py-4 flex items-center justify-between gap-1.5 sm:gap-3 border-b border-white/5 backdrop-blur-xl bg-slate-950/40">
              <div className="flex items-center gap-1.5 sm:gap-4 min-w-0 flex-1">
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-all shrink-0"
                >
                  <ChevronLeft className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-xl font-extrabold tracking-tight text-white font-display truncate min-w-0">
                    {activeTab === 'dashboard' && 'My Dashboard'}
                    {activeTab === 'about' && 'About Veylentra'}
                    {activeTab === 'meet' && 'Veylentra Meet (Virtual Classroom)'}
                    {['study_hub', 'tasks', 'planner', 'flashcards'].includes(activeTab) && (
                      studyHubSubTab === 'tasks' ? 'Tasks & Focus Objectives' :
                      studyHubSubTab === 'planner' ? 'Study Schedule Planner' :
                      'Study Center & Flashcards'
                    )}
                    {activeTab === 'whiteboard' && 'Drawing Board'}
                    {activeTab === 'houses' && 'House Standings'}
                    {activeTab === 'materials' && 'Class Files & Materials'}
                    {activeTab === 'assignments' && 'Assignment Center'}
                    {activeTab === 'homework' && 'My Homework'}
                    {(activeTab === 'brain_battle' || activeTab === 'quiz') && 'Brain Battle Arena'}
                    {activeTab === 'feedback' && 'Feedback Box'}
                    {activeTab === 'ai_teacher' && 'My AI Tutor'}
                    {activeTab === 'peer_chat' && 'Class Chat Room'}
                    {activeTab === 'faculty' && 'Teacher Dashboard'}
                    {activeTab === 'notes' && 'My Personal Notes'}
                    {activeTab === 'pomodoro' && 'Focus Timer'}
                    {activeTab === 'analytics' && 'My Progress'}
                    {activeTab === 'profile' && 'My Profile'}
                    {activeTab === 'blogs' && 'Educational Blogs'}
                    {activeTab === 'calendar' && 'Academic Calendar'}
                    {activeTab === 'gradebook' && 'Digital Gradebook'}
                    {activeTab === 'report_cards' && 'Official Report Cards'}
                    {(activeTab === 'whats_new' || activeTab === 'whats-new') && "What's New & Release Logs"}
                  </h2>
                </div>
              </div>

              {/* Status and Clock widget */}
              <div className="flex items-center gap-1 sm:gap-3 text-xs font-semibold shrink-0">
                
                {/* Classroom Security Center */}
                {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '') && (
                  <button
                    type="button"
                    onClick={() => setSecurityMenuOpen(true)}
                    className={`p-1.5 sm:px-3 sm:py-2 rounded-xl border flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-all min-h-[32px] sm:min-h-[38px] ${
                      presentationMode 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                        : 'bg-slate-900 border-white/5 hover:bg-slate-800 text-slate-300'
                    }`}
                    title="Classroom Security Center"
                  >
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Security</span>
                    {presentationMode && (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    )}
                  </button>
                )}
                
                {/* Accessibility Toolbar panel */}
                <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/5 shadow-inner">
                  <button 
                    onClick={() => setFontSize(prev => prev === 'standard' ? 'large' : prev === 'large' ? 'huge' : 'standard')}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300"
                    title="Toggle Font Size"
                  >
                    <span className="font-bold">A</span>
                    {fontSize === 'large' && <span className="text-[9px] text-indigo-400 ml-0.5">+</span>}
                    {fontSize === 'huge' && <span className="text-[9px] text-indigo-400 ml-0.5">++</span>}
                  </button>
                  <button 
                    onClick={() => setHighContrast(!highContrast)}
                    className={`p-1.5 rounded-lg text-slate-300 ${highContrast ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'}`}
                    title="Toggle High Contrast Mode"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setTtsEnabled(!ttsEnabled)}
                    className={`p-1.5 rounded-lg ${ttsEnabled ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:bg-white/10'}`}
                    title="Toggle TTS Assistance"
                  >
                    {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      soundService.playButtonClick();
                      setIsSoundSettingsModalOpen(true);
                    }}
                    className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                      soundService.getPreferences().muted 
                        ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' 
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                    title="Sound Effects & Audio Settings (8 Pixabay FX)"
                  >
                    {soundService.getPreferences().muted ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span className="hidden xl:inline text-[10px] font-bold font-mono">Audio</span>
                  </button>
                </div>

                <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-white/5 font-mono text-indigo-400 shadow-sm">
                  <Clock className="w-4 h-4" />
                  <span>{clock}</span>
                </div>



                {/* Broadcast Action Button */}
                {['super_admin', 'admin', 'teacher', 'coordinator'].includes(effectiveRole) && (
                  <button
                    onClick={() => {
                      soundService.playAppearSound();
                      setIsBroadcastModalOpen(true);
                    }}
                    className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all active:scale-95 min-h-[32px] sm:min-h-[38px]"
                    title="Send School/Class Broadcast Announcement"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Broadcast</span>
                  </button>
                )}

                {/* Notification Center */}
                <div className="relative">
                  <button
                    onClick={() => {
                      soundService.playAppearSound();
                      setShowNotifCenter(!showNotifCenter);
                    }}
                    className="relative p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-white/5 hover:bg-slate-800 hover:text-white text-slate-300 transition-all flex items-center justify-center cursor-pointer min-h-[32px] min-w-[32px] sm:min-h-[38px] sm:min-w-[38px]"
                    title="Academic Notification Hub"
                  >
                    <Bell className="w-4 h-4" />
                    {notifications.filter(n => !n.isRead).length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] sm:text-[9px] font-bold text-white leading-none scale-100 animate-pulse">
                        {notifications.filter(n => !n.isRead).length}
                      </span>
                    )}
                  </button>

                  <NotificationCenter
                    currentUser={currentUser}
                    isOpen={showNotifCenter}
                    onClose={() => setShowNotifCenter(false)}
                    onNavigateTab={(tab) => setActiveTab(tab)}
                  />
                </div>

                {/* What's New Header Indicator Button */}
                <button
                  onClick={() => handleTabSelect('whats_new')}
                  className={`p-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 relative border shadow-sm cursor-pointer min-h-[32px] sm:min-h-[38px] ${
                    activeTab === 'whats_new' || activeTab === 'whats-new'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30'
                      : 'bg-slate-900 border-white/5 hover:bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                  title="What's New in Veylentra"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="hidden sm:inline">What's New</span>
                  {whatsNewUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 sm:static flex h-3.5 min-w-3.5 sm:h-4 sm:min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[8px] sm:text-[9px] font-black text-white leading-none animate-pulse">
                      {whatsNewUnreadCount}
                    </span>
                  )}
                </button>

                {effectiveRole === 'student' && currentUser.house && (
                  <span className={`hidden lg:inline-flex px-3 py-1.5 rounded-full ${getHouseBadgeColor(currentUser.house)} font-bold tracking-wide uppercase text-[10px]`}>
                    📍 {currentUser.house} House
                  </span>
                )}
              </div>
            </header>

            {/* Base View Layout Wrapper */}
            <main className={`flex-1 p-2 sm:p-6 md:p-8 pb-24 sm:pb-12 max-w-7xl w-full mx-auto space-y-4 sm:space-y-8 min-w-0 ${fontSize === 'large' ? 'text-lg' : fontSize === 'huge' ? 'text-xl' : 'text-sm'}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 sm:space-y-8"
                >
              {/* Tab: Panel Mode Launcher */}
              {activeTab === 'panel_mode' && effectiveRole !== 'student' && (
                <div className="space-y-6 animate-fadeIn min-h-[calc(100dvh-140px)] flex flex-col pt-2 sm:pt-4">
                  {/* Banner */}
                  <div className="p-5 sm:p-8 md:p-10 rounded-3xl relative overflow-hidden flex flex-col items-center justify-center text-center gap-3 sm:gap-4 border border-indigo-500/20 bg-slate-900 shadow-2xl z-10 shrink-0">
                    <div className="absolute top-0 w-full h-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full relative z-10">Multi-Tool Terminal • Academic Hub</span>
                    <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white font-display relative z-10 tracking-tight">System Panel Mode</h2>
                    <p className="text-slate-400 max-w-lg text-xs sm:text-sm relative z-10 leading-relaxed">Quickly launch and access essential academic tools, interactive whiteboards, smart assistant Orion, or focus timers.</p>
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 min-h-0">
                    <div 
                      onClick={() => handleTabSelect('whiteboard')}
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-indigo-500/50 hover:shadow-[0_0_40px_-5px_rgba(99,102,241,0.2)] flex flex-col items-center justify-center text-center gap-4 h-full"
                    >
                      <div className="w-16 h-16 sm:w-24 sm:h-24 bg-indigo-500/10 text-indigo-400 flex items-center justify-center rounded-2xl sm:rounded-[2rem] text-3xl sm:text-5xl group-hover:scale-110 transition-transform">✏️</div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">Class Whiteboard</h3>
                        <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">Launch the interactive full-screen classroom smart board projection.</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => handleTabSelect('materials')}
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-emerald-500/50 hover:shadow-[0_0_40px_-5px_rgba(16,185,129,0.2)] flex flex-col items-center justify-center text-center gap-4 h-full"
                    >
                      <div className="w-16 h-16 sm:w-24 sm:h-24 bg-emerald-500/10 text-emerald-400 flex items-center justify-center rounded-2xl sm:rounded-[2rem] text-3xl sm:text-5xl group-hover:scale-110 transition-transform">📚</div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
                          {effectiveRole === 'teacher' ? 'Teacher Materials Vault' : 'Materials Hub'}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                          {effectiveRole === 'teacher' ? 'Access secured master documents, exams, and grading rubrics.' : 'Access synced documents, resources, and shared classroom files.'}
                        </p>
                      </div>
                    </div>

                    <div 
                      onClick={() => handleTabSelect('ai_teacher')}
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-pink-500/50 hover:shadow-[0_0_40px_-5px_rgba(236,72,153,0.2)] flex flex-col items-center justify-center text-center gap-4 h-full"
                    >
                      <div className="w-16 h-16 sm:w-24 sm:h-24 bg-pink-500/10 text-pink-400 flex items-center justify-center rounded-2xl sm:rounded-[2rem] text-3xl sm:text-5xl group-hover:scale-110 transition-transform">🤖</div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
                          {effectiveRole === 'teacher' ? 'AI Admin & Assessor' : 'AI Assistant'}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                          {effectiveRole === 'teacher' ? 'Query the AI to draft rubrics, construct quizzes, and parse student data.' : 'Query the AI tutor for homework help and guided studying.'}
                        </p>
                      </div>
                    </div>

                    <div 
                      onClick={() => setIsJarvisActive(true)}
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-cyan-500/50 hover:shadow-[0_0_40px_-5px_rgba(6,182,212,0.2)] flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden h-full"
                    >
                      <div className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="w-16 h-16 sm:w-24 sm:h-24 bg-cyan-500/10 text-cyan-400 flex items-center justify-center rounded-2xl sm:rounded-[2rem] text-3xl sm:text-5xl group-hover:scale-110 transition-transform relative z-10">🎙️</div>
                      <div className="relative z-10">
                        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mb-2 uppercase">Orion Copilot</h3>
                        <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">Activate the voice-command smart classroom AI assistant.</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => handleTabSelect('notes')}
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-amber-500/50 hover:shadow-[0_0_40px_-5px_rgba(245,158,11,0.2)] flex flex-col items-center justify-center text-center gap-4 h-full"
                    >
                      <div className="w-16 h-16 sm:w-24 sm:h-24 bg-amber-500/10 text-amber-400 flex items-center justify-center rounded-2xl sm:rounded-[2rem] text-3xl sm:text-5xl group-hover:scale-110 transition-transform">📝</div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
                          {effectiveRole === 'teacher' ? 'Teaching Records' : 'My Notes'}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                          {effectiveRole === 'teacher' ? 'Log private administrative and student behavioral records.' : 'Write, edit, and organize your personal quick scratchpad.'}
                        </p>
                      </div>
                    </div>

                    <div 
                      onClick={() => handleTabSelect('pomodoro')}
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-red-500/50 hover:shadow-[0_0_40px_-5px_rgba(239,68,68,0.2)] flex flex-col items-center justify-center text-center gap-4 h-full"
                    >
                      <div className="w-16 h-16 sm:w-24 sm:h-24 bg-red-500/10 text-red-400 flex items-center justify-center rounded-2xl sm:rounded-[2rem] text-3xl sm:text-5xl group-hover:scale-110 transition-transform">⏲️</div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">Focus Timer</h3>
                        <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">Customizable work sessions with auditory bell sound alerts.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 1: Dashboard View */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-fadeIn">
                  {dataLoading && !showStartup ? (
                    <div className="space-y-8">
                      <Skeleton className="h-48 w-full rounded-3xl" />
                      <div className="space-y-4">
                        <Skeleton className="h-4 w-1/4" />
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                          {Array.from({ length: 7 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </div>
                    </div>
                  ) : (
                    <>
                  
                  {/* Status Banner for Pending Requests */}
                  {currentUser.accountStatus && currentUser.accountStatus !== 'approved' && (
                    <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${
                      currentUser.accountStatus.startsWith('pending')
                        ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                        : 'bg-red-500/5 border-red-500/20 text-red-300'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">
                          {currentUser.accountStatus.startsWith('pending') ? '⏳' : '❌'}
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider">
                            Account Status: {currentUser.accountStatus.replace('pending_', 'Pending ').toUpperCase()}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Your request to join as a {currentUser.requestedRole?.toUpperCase()} is currently awaiting administrator verification. In the meantime, you have been granted temporary Student-level access to explore.
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold uppercase px-2.5 py-1 bg-white/10 rounded-full font-mono shrink-0 text-center">
                        Awaiting Admin Approval
                      </span>
                    </div>
                  )}

                  {/* Time-Controlled Promotional Banners */}
                  <PromotionalBanners 
                    onNavigateTab={(tab) => {
                      if (tab === 'profile') {
                        setActiveTab('profile');
                        setProfileTab('settings');
                      } else {
                        setActiveTab(tab as any);
                      }
                    }} 
                  />

                  {/* Welcome Hero & Context Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className={`p-5 sm:p-7 rounded-3xl relative overflow-hidden backdrop-blur-md border shadow-xl ${
                      currentUser.house === 'Ruby'
                        ? 'bg-gradient-to-r from-red-950/40 to-slate-900 border-red-500/20'
                        : currentUser.house === 'Emerald'
                        ? 'bg-gradient-to-r from-emerald-950/40 to-slate-900 border-emerald-500/20'
                        : currentUser.house === 'Sapphire'
                        ? 'bg-gradient-to-r from-blue-950/40 to-slate-900 border-blue-500/20'
                        : currentUser.house === 'Topaz'
                        ? 'bg-gradient-to-r from-amber-950/40 to-slate-900 border-amber-500/20'
                        : 'bg-gradient-to-r from-indigo-950/40 to-slate-900 border-white/10'
                    }`}
                  >
                    <BorderBeam size={220} duration={14} colorFrom="#6366f1" colorTo="#ec4899" />
                    {(getSavedTheme() === 'halloween' || currentUser.raw_data?.theme === 'halloween') && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 0.85, scale: 1 }}
                        className="absolute top-2 right-4 text-5xl sm:text-7xl pointer-events-none select-none halloween-flicker-item z-10"
                      >
                        🎃 🕸️
                      </motion.div>
                    )}
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
                          <span>Academic Workspace</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-300 capitalize">{effectiveRole?.replace('_', ' ')}</span>
                          {effectiveRole === 'student' && currentUser.grade && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-300">{currentUser.grade} ({currentUser.section})</span>
                            </>
                          )}
                        </div>
                        <h1 className="text-xl sm:text-3xl font-black font-display text-white tracking-tight">
                          <SplitTextReveal text={`Welcome back, ${currentUser.name}`} />
                        </h1>
                        <p className="text-slate-300 max-w-xl text-xs sm:text-sm leading-relaxed">
                          {effectiveRole === 'student'
                            ? `Representing ${currentUser.house} House in Section ${currentUser.section}. Stay on top of your daily schedule, assignments, and flashcard reviews.`
                            : `Logged in as ${currentUser.specialtySubject || 'Faculty'} educator. Manage live smartboards, review submissions, and track class progress.`}
                        </p>
                      </div>

                      {/* Study Streak Summary */}
                      <div className="flex items-center gap-3.5 bg-slate-950/70 px-4 py-3 rounded-2xl border border-white/10 shrink-0">
                        <Flame className="w-7 h-7 text-orange-400 shrink-0" />
                        <div>
                          <p className="text-base sm:text-lg font-black font-mono tabular-nums text-white">
                            <NumberTicker value={currentUser.streakDays || 5} suffix=" Days" />
                          </p>
                          <p className="text-[11px] text-slate-400">Active learning streak</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Dashboard Quick Navigation Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Quick Actions & Destinations
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                      {effectiveRole === 'student' && (
                        <>
                          <button
                            onClick={() => handleTabSelect('meet')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">📹</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Live Meet</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('notes')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">📝</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Lecture Notes</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('homework')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">📓</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Homework Hub</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('brain_battle')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">⚔️</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Brain Battle</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('study_hub')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left relative cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">🎯</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Study Hub</span>
                            {dueCardsCount > 0 && (
                              <span className="absolute top-2.5 right-2.5 text-[10px] font-mono font-bold text-rose-400">
                                {dueCardsCount} due
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => handleTabSelect('pomodoro')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">⏱️</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Focus Timer</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('life')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">🚀</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Veylentra Life</span>
                          </button>
                        </>
                      )}

                      {effectiveRole === 'teacher' && (
                        <>
                          <button
                            onClick={() => handleTabSelect('faculty')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">👨‍🏫</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Faculty Center</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('panel_mode')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">🖥️</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Smartboard</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('attendance_manager')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">📋</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Attendance Roll</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('homework')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">📓</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Homework</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('assignments')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">📚</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Assignments</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('funzone')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">🎡</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Teacher Fun Zone</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('life')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer active:scale-95 transition-transform"
                          >
                            <span className="text-xl">🚀</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Veylentra Life</span>
                          </button>
                        </>
                      )}

                      {effectiveRole === 'coordinator' && (
                        <>
                          <button
                            onClick={() => handleTabSelect('attendance_manager')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-xl">📋</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Attendance Ledger</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('blogs')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-xl">💎</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">School Blogs</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('planner')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-xl">📅</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Study Planner</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('life')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-xl">🚀</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Veylentra Life</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('profile')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-xl">👤</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">My Profile</span>
                          </button>
                        </>
                      )}

                      {(effectiveRole === 'admin' || effectiveRole === 'super_admin') && (
                        <>
                          <button
                            onClick={() => handleTabSelect('admin')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-xl">⚙️</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Control Center</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('attendance_manager')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-xl">📋</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Attendance Roll</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('blogs')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-xl">💎</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Blogs Portal</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('life')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-xl">🚀</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">Veylentra Life</span>
                          </button>
                          <button
                            onClick={() => handleTabSelect('profile')}
                            className="bento-card p-3.5 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-xl">👤</span>
                            <span className="text-xs font-bold text-white whitespace-nowrap">My Profile</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Core Metrics Summary Strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div
                      onClick={() => { setStudyHubSubTab('tasks'); handleTabSelect('study_hub'); }}
                      className="bento-card p-4 sm:p-5 rounded-2xl flex items-center justify-between cursor-pointer"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-slate-400">Open Tasks</span>
                        <h3 className="text-xl sm:text-2xl font-black font-mono tabular-nums text-white">
                          {tasks.filter(t => !t.completed).length}
                        </h3>
                      </div>
                      <div className="h-9 w-9 bg-indigo-500/15 rounded-xl flex items-center justify-center text-indigo-400">
                        <CheckSquare className="w-4 h-4" />
                      </div>
                    </div>

                    <div
                      onClick={() => handleTabSelect('notes')}
                      className="bento-card p-4 sm:p-5 rounded-2xl flex items-center justify-between cursor-pointer"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-slate-400">Saved Notes</span>
                        <h3 className="text-xl sm:text-2xl font-black font-mono tabular-nums text-white">
                          {vaultNotes.length}
                        </h3>
                      </div>
                      <div className="h-9 w-9 bg-amber-500/15 rounded-xl flex items-center justify-center text-amber-400">
                        <FileText className="w-4 h-4" />
                      </div>
                    </div>

                    <div
                      onClick={() => handleTabSelect('brain_battle')}
                      className="bento-card p-4 sm:p-5 rounded-2xl flex items-center justify-between cursor-pointer"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-slate-400">Brain Battles</span>
                        <h3 className="text-xl sm:text-2xl font-black font-mono tabular-nums text-white">
                          {currentUser.quizzesTaken || 3}
                        </h3>
                      </div>
                      <div className="h-9 w-9 bg-emerald-500/15 rounded-xl flex items-center justify-center text-emerald-400">
                        <Trophy className="w-4 h-4" />
                      </div>
                    </div>

                    <div
                      onClick={() => handleTabSelect('pomodoro')}
                      className="bento-card p-4 sm:p-5 rounded-2xl flex items-center justify-between cursor-pointer"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-slate-400">Study Hours</span>
                        <h3 className="text-xl sm:text-2xl font-black font-mono tabular-nums text-white">
                          {currentUser.studyHours || 12}h
                        </h3>
                      </div>
                      <div className="h-9 w-9 bg-rose-500/15 rounded-xl flex items-center justify-center text-rose-400">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* StudentOS Scholar Gamification Summary Card */}
                  <DashboardGamificationCard currentUser={currentUser} />

                  {/* StudentOS Life — Role-Aware Dashboard Community Hub Card (Visible to All Authenticated Roles) */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-slate-900 border border-indigo-500/30 shadow-xl relative overflow-hidden uiverse-card-hover">
                    <div className="absolute -right-12 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-black uppercase tracking-widest">
                            🚀 Veylentra Life
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase">
                            {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '')
                              ? `${(effectiveRole || 'faculty').replace('_', ' ')} Access`
                              : 'Student Community'}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-black font-display text-white">
                          {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '')
                            ? 'Campus Community, Competitions & Merit Badges'
                            : 'Competitions, Student Clubs, Live Polls & House Spirit'}
                        </h3>
                        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                          {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '')
                            ? 'Organize school-wide competitions, supervise student clubs, publish campus polls, and award official merit badges.'
                            : 'Register for inter-house hackathons and Olympiads, join student clubs, vote in live school polls, and earn merit badges.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTabSelect('life')}
                          className="uiverse-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
                        >
                          <span>🚀</span>
                          <span>
                            {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '')
                              ? 'Manage Veylentra Life'
                              : 'Explore Veylentra Life'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* High Quality Bento Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Column 1: School dashboard standing lists & Schedules */}
                    <div className="lg:col-span-8 space-y-6">
                      
                      {/* Interactive Lesson Broadcast banner (if active) */}
                      {activeBroadcast && (
                        <div className="p-6 rounded-3xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-between flex-wrap gap-4 animate-pulse">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-xl animate-spin">📡</div>
                            <div>
                              <p className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest">Active Live Broadcast</p>
                              <p className="text-base font-bold text-white leading-tight">{activeBroadcast.title}</p>
                              <p className="text-xs text-slate-300">Subject: {activeBroadcast.subject} • Pres. {activeBroadcast.presentedBy}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setStudentJoinedClass(true);
                              handleTabSelect('whiteboard');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md uppercase transition-all"
                          >
                            Join Smartboard Classroom
                          </button>
                        </div>
                      )}

                      {/* Section Timetable and schedule */}
                      <div className="smart-glass p-6 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-black font-display text-white">Daily Schedule Standings</h3>
                          <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">Section Astra & Solara</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {schedules.map(sch => (
                            <div key={sch.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors flex justify-between items-center">
                              <div>
                                <p className="font-bold text-sm text-white">{sch.subject}</p>
                                <p className="text-xs text-slate-400">{sch.day}</p>
                              </div>
                              <div className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1.5 rounded-lg">
                                {sch.time}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Official Bulletin boards */}
                      <div className="smart-glass p-6 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-black font-display text-white">Academic Notice Board</h3>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">LTS Verified Announcements</span>
                        </div>
                        <div className="space-y-3.5">
                          {announcements.length > 0 ? (
                            announcements.map(ann => (
                              <div key={ann.id} className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/10 transition-all space-y-2">
                                <div className="flex justify-between items-center flex-wrap gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${ann.tagColor || 'bg-indigo-500/10 text-indigo-400'}`}>{ann.tag || 'Notice'}</span>
                                  <span className="text-[10px] text-slate-500">{ann.date || 'Today'}</span>
                                </div>
                                <h4 className="font-bold text-sm text-white leading-tight">{ann.title}</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">{ann.content}</p>
                                <button 
                                  onClick={() => speakText(`${ann.title}. ${ann.content}`)}
                                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg mt-1 transition-all"
                                >
                                  <Volume2 className="w-3.5 h-3.5" /> Read Aloud
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center text-slate-500 font-mono text-xs">
                              📢 No announcements posted yet.
                            </div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Column 2: House Standings Leaderboards & Quick Challenges */}
                    <div className="lg:col-span-4 space-y-6">
                      
                      {/* House System standings leaderboard */}
                      <div className="smart-glass p-6 rounded-3xl space-y-5">
                        <div className="space-y-1">
                          <h3 className="text-base font-extrabold font-display text-white">School House Standings</h3>
                          <p className="text-xs text-slate-400 leading-tight">Compete in quizzes and schedules to earn points for your house alliance.</p>
                        </div>

                        <div className="space-y-3">
                          {Object.entries(housePoints).map(([house, points]) => (
                            <div key={house} className="p-3.5 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${getHouseBadgeColor(house as HouseType)}`}>
                                  {house[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white">{house} House</p>
                                  <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Allied Standings</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-sm text-white">{points}</p>
                                <p className="text-[8px] text-slate-500">Pts</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Active House specific challenges */}
                      <div className="smart-glass p-6 rounded-3xl space-y-4">
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <Award className="w-4 h-4 text-amber-400" /> Allied Challenges
                        </h4>
                        <div className="space-y-3 text-xs leading-relaxed">
                          <div className="p-2.5 bg-slate-900 rounded-xl space-y-1">
                            <p className="font-bold text-emerald-400">Emerald Challenge</p>
                            <p className="text-[10px] text-slate-400">Have 5 students complete CS BST quiz vectors continuously.</p>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                              <div className="bg-emerald-500 h-full w-[60%]"></div>
                            </div>
                          </div>

                          <div className="p-2.5 bg-slate-900 rounded-xl space-y-1">
                            <p className="font-bold text-orange-400">Topaz Challenge</p>
                            <p className="text-[10px] text-slate-400">Accrue combined 120 focus study blocks.</p>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                              <div className="bg-orange-500 h-full w-[45%]"></div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Featured Academic Materials Hub Integration Row */}
                  <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-black font-display text-white">Featured Academic Materials</h3>
                        <p className="text-xs text-slate-400">Hand-picked contributions from your class, section, and faculty.</p>
                      </div>
                      <button 
                        onClick={() => handleTabSelect('materials')}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-500/10 px-3.5 py-2 rounded-xl border border-indigo-500/20 shadow-md hover:scale-[1.01] transition-transform"
                      >
                        Explore Materials Hub →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* Section 1: Recent Materials */}
                      <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-1">⏱️ Recent Uploads</span>
                        </div>
                        <div className="space-y-2">
                          {materials.slice(0, 3).map((mat) => (
                            <div key={mat.id} className="p-2.5 bg-black/25 rounded-xl border border-white/5 hover:bg-black/40 cursor-pointer transition-colors" onClick={() => handleTabSelect('materials')}>
                              <p className="text-xs font-bold text-white truncate">{mat.title}</p>
                              <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400">
                                <span>{mat.subject}</span>
                                <span>{mat.createdAt}</span>
                              </div>
                            </div>
                          ))}
                          {materials.length === 0 && (
                            <p className="text-[11px] text-slate-500 italic py-2">No uploaded materials yet.</p>
                          )}
                        </div>
                      </div>

                      {/* Section 2: Trending Materials */}
                      <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-extrabold text-orange-400 uppercase tracking-wider flex items-center gap-1">🔥 Trending Materials</span>
                        </div>
                        <div className="space-y-2">
                          {[...materials]
                            .sort((a, b) => ((b.downloads || 0) + (b.views || 0)) - ((a.downloads || 0) + (a.views || 0)))
                            .slice(0, 3)
                            .map((mat) => (
                              <div key={mat.id} className="p-2.5 bg-black/25 rounded-xl border border-white/5 hover:bg-black/40 cursor-pointer transition-colors" onClick={() => handleTabSelect('materials')}>
                                <p className="text-xs font-bold text-white truncate">{mat.title}</p>
                                <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400">
                                  <span>{mat.subject}</span>
                                  <span className="text-slate-300">📈 {(mat.downloads || 0) + (mat.views || 0)} pts</span>
                                </div>
                              </div>
                            ))}
                          {materials.length === 0 && (
                            <p className="text-[11px] text-slate-500 italic py-2">No trending materials yet.</p>
                          )}
                        </div>
                      </div>

                      {/* Section 3: Verified Materials */}
                      <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1">✅ Teacher Verified</span>
                        </div>
                        <div className="space-y-2">
                          {materials.filter(m => m.isVerified).slice(0, 3).map((mat) => (
                            <div key={mat.id} className="p-2.5 bg-black/25 rounded-xl border border-white/5 hover:bg-black/40 cursor-pointer transition-colors" onClick={() => handleTabSelect('materials')}>
                              <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                                <span>{mat.title}</span>
                              </p>
                              <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400">
                                <span>{mat.subject}</span>
                                <span className="text-emerald-400 text-[9px] uppercase font-black font-sans leading-none">Verified</span>
                              </div>
                            </div>
                          ))}
                          {materials.filter(m => m.isVerified).length === 0 && (
                            <p className="text-[11px] text-slate-500 italic py-2">No verified materials yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                    </>
                  )}
                </div>
              )}

              {/* Unified Study Hub View: Flashcards (SM-2), Task Manager, & Study Schedule Planner */}
              {['study_hub', 'tasks', 'planner', 'flashcards'].includes(activeTab) && (
                <div className="space-y-6 animate-fadeIn">
                  {dataLoading && !showStartup ? (
                    <div className="space-y-6">
                      <Skeleton className="h-16 w-full rounded-2xl" />
                      <div className="smart-glass p-6 rounded-3xl space-y-4">
                        <Skeleton className="h-6 w-1/3" />
                        <SkeletonList count={5} />
                      </div>
                    </div>
                  ) : (
                    <>
                  {/* Study Hub Unified Sub-Tabs Navigation */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-xl p-2.5 rounded-2xl border border-white/10 shadow-lg relative z-20">
                    <div className="w-full sm:max-w-md">
                      <ProfessionalTabDropdown
                        options={[
                          {
                            id: 'flashcards',
                            label: 'Study Center & Flashcards (SM-2)',
                            icon: '🗂️',
                            badge: dueCardsCount > 0 ? `${dueCardsCount} due` : undefined,
                            badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
                            description: 'Spaced repetition decks and active recall practice'
                          },
                          {
                            id: 'tasks',
                            label: 'Task Manager',
                            icon: '📋',
                            badge: tasks.filter(t => !t.completed).length > 0 ? tasks.filter(t => !t.completed).length : undefined,
                            description: 'Track assignments, syllabus progress, and goals'
                          },
                          {
                            id: 'planner',
                            label: 'Study Schedule Planner',
                            icon: '📅',
                            badge: schedules.length > 0 ? schedules.length : undefined,
                            description: 'Daily revision timetable and exam prep blocks'
                          }
                        ]}
                        selectedId={studyHubSubTab}
                        onSelect={(id) => {
                          setStudyHubSubTab(id as any);
                          setActiveTab('study_hub');
                        }}
                        size="md"
                      />
                    </div>

                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-xl border border-white/5 text-[11px] text-slate-400 font-mono">
                      <span>⚡ Mode:</span>
                      <span className="text-indigo-400 font-bold capitalize">
                        {studyHubSubTab === 'flashcards' ? 'Study Center (Cards)' : studyHubSubTab === 'tasks' ? 'Task Manager' : 'Study Planner'}
                      </span>
                    </div>
                  </div>

                  {/* Sub-tab 1: Flashcards & Spaced Repetition Study Center */}
                  {studyHubSubTab === 'flashcards' && (
                    <StudyCenterFlashcards 
                      key={currentUser?.uid || currentUser?.email || 'flashcards'}
                      currentUser={currentUser} 
                      showNotification={showNotification}
                      onNavigateTab={handleTabSelect}
                    />
                  )}

                  {/* Sub-tab 2: Task Manager View */}
                  {studyHubSubTab === 'tasks' && (
                    <div className="smart-glass p-4 sm:p-6 md:p-8 rounded-3xl space-y-6 max-w-3xl mx-auto animate-fadeIn">
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black font-display text-white">Target Tasks & Focus Objectives</h3>
                        <p className="text-xs text-slate-400">Record syllabus preparation sequences, project homework, and term tests timelines.</p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input 
                          type="text"
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          placeholder="e.g., Study AVL Tree balancing heights and double rotations..."
                          className="flex-1 px-4 py-3 text-sm rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button 
                          onClick={handleAddTask}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl text-xs uppercase tracking-wide transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" /> Add Task
                        </button>
                      </div>

                      <Reorder.Group 
                        axis="y" 
                        values={tasks} 
                        onReorder={handleReorderTasks}
                        className="space-y-2.5 pt-4 border-t border-white/5"
                      >
                        {tasks.map(t => (
                          <Reorder.Item 
                            key={t.id} 
                            value={t}
                            className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-center gap-3 pointer-events-none">
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleTask(t.id); }}
                                className={`h-5 w-5 rounded flex items-center justify-center border transition-all pointer-events-auto ${t.completed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-white/20 hover:border-white'}`}
                              >
                                {t.completed && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>
                              <span className={`text-sm ${t.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                {t.title}
                              </span>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteTask(t.id); }}
                              className="text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors pointer-events-auto"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </Reorder.Item>
                        ))}

                        {tasks.length === 0 && (
                          <div className="text-center py-8 text-slate-500">
                            No active task milestones recorded yet. Create one!
                          </div>
                        )}
                      </Reorder.Group>
                    </div>
                  )}

                  {/* Sub-tab 3: Syllabus Planner & Study Sessions View */}
                  {studyHubSubTab === 'planner' && (
                    <div className="smart-glass p-4 sm:p-6 md:p-8 rounded-3xl space-y-6 max-w-5xl mx-auto animate-fadeIn">
                      <SyllabusStudyPlanner
                        currentUser={currentUser}
                        effectiveRole={effectiveRole}
                        showNotification={showNotification}
                        onNavigateToTab={handleTabSelect}
                        legacySchedules={schedules}
                      />
                    </div>
                  )}
                  </>
                )}
              </div>
            )}

              {/* Tab: Personal Lecture Notes Workspace */}
              {activeTab === 'notes' && (
                <div className="space-y-6 animate-fadeIn">
                  {dataLoading && !showStartup ? (
                    <div className="space-y-6">
                      <Skeleton className="h-16 w-full rounded-2xl" />
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-3 space-y-4">
                          <SkeletonList count={6} />
                        </div>
                        <div className="lg:col-span-9">
                          <Skeleton className="h-[600px] w-full rounded-3xl" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                  
                  {/* Notes Header Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 sm:p-4 rounded-2xl border border-white/5 shadow-sm">
                    <div>
                      <h2 className="text-lg font-black text-white font-display uppercase tracking-tight flex items-center gap-2">
                        <span>📝 Lecture Notes & Knowledge Base</span>
                      </h2>
                      <p className="text-xs text-slate-400">Notion-style markdown workspace with slash commands, live preview, outline TOC, and 6-digit peer collaboration.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setCollabJoinError('');
                          setCollabJoinCodeInput('');
                          setCollabJoinModalOpen(true);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                        title="Join a shared note using 6-digit code"
                      >
                        <Users2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Join Note</span>
                      </button>

                      <button
                        onClick={handleCreateNewNote}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-md"
                        title="Create a new note"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Note</span>
                      </button>

                      <button
                        onClick={() => {
                          setStudyHubSubTab('flashcards');
                          handleTabSelect('study_hub');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
                        title="Open Interactive Flashcards & SM-2 Study Center"
                      >
                        <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="hidden sm:inline">Flashcards</span>
                        {dueCardsCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-black animate-pulse">
                            {dueCardsCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 3-Column Layout: Left Explorer (3), Center Canvas (6 or 9), Right Outline (3) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column: Folders & Notes Explorer (File Manager) */}
                    <div className="lg:col-span-3 smart-glass p-4 rounded-3xl space-y-4 border border-white/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-white font-display uppercase tracking-tight flex items-center gap-1.5">
                            <span>📂 Explorer</span>
                          </h3>
                          <p className="text-[10px] text-slate-400">Folders & notes vault</p>
                        </div>
                        <button 
                          onClick={handleCreateNewNote}
                          className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all font-bold text-xs uppercase shadow flex items-center gap-1 active:scale-95 cursor-pointer"
                          title="New blank note"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Notes Search bar */}
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="Filter notes..."
                          value={newNoteTitle}
                          onChange={e => setNewNoteTitle(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-white/5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      </div>

                      {/* File Manager Breadcrumb & Action Bar */}
                      {(() => {
                        const activeVaultFolder = vaultFolders.find(f => f.id === activeVaultFolderId);
                        const currentNotes = vaultNotes
                          .filter(n => {
                            if (activeVaultFolderId) {
                              return n.folder_id === activeVaultFolderId;
                            }
                            return !n.folder_id;
                          })
                          .filter(n => !newNoteTitle.trim() || n.title.toLowerCase().includes(newNoteTitle.toLowerCase()) || n.subject.toLowerCase().includes(newNoteTitle.toLowerCase()))
                          .sort((a, b) => {
                            if ((a as any).isPinned && !(b as any).isPinned) return -1;
                            if (!(a as any).isPinned && (b as any).isPinned) return 1;
                            return 0;
                          });

                        return (
                          <>
                            {/* Breadcrumb Navigation Bar */}
                            <div className="flex items-center justify-between gap-1.5 p-2 bg-slate-950/70 border border-white/5 rounded-2xl text-[11px]">
                              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none no-scrollbar min-w-0">
                                <button
                                  onClick={() => setActiveVaultFolderId(null)}
                                  className={`px-2 py-0.5 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 ${!activeVaultFolderId ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                >
                                  <span>🏠 Root</span>
                                </button>
                                {activeVaultFolder && (
                                  <>
                                    <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 truncate max-w-[100px]">
                                      <span>📁 {activeVaultFolder.name}</span>
                                    </div>
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {activeVaultFolderId && (
                                  <button
                                    onClick={() => setActiveVaultFolderId(null)}
                                    className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition-all"
                                    title="Back to Root Folders"
                                  >
                                    ↑ Up
                                  </button>
                                )}
                                <button
                                  onClick={() => setShowVaultFolderModal(true)}
                                  className="px-2 py-0.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/25 font-bold text-[10px] flex items-center gap-1 transition-all"
                                  title="Create Personal Notes Folder"
                                >
                                  <FolderPlus className="w-3 h-3" />
                                  <span>+ Folder</span>
                                </button>
                              </div>
                            </div>

                            {/* Windows / Android-Like File Manager: Folder Cards Grid (at Root Level) */}
                            {!activeVaultFolderId && vaultFolders.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between px-1">
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                                    <span>📁 Folders ({vaultFolders.length})</span>
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {vaultFolders.map(f => {
                                    const noteCount = vaultNotes.filter(n => n.folder_id === f.id).length;
                                    return (
                                      <motion.div
                                        key={f.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setActiveVaultFolderId(f.id)}
                                        className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-white/5 hover:border-amber-500/40 transition-all cursor-pointer group flex flex-col justify-between space-y-1.5 shadow-sm"
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-base">📁</span>
                                          <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                            <button
                                              onClick={() => {
                                                setRenameVaultFolderModal({ id: f.id, name: f.name });
                                                setRenameVaultInput(f.name);
                                              }}
                                              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                                              title="Rename Folder"
                                            >
                                              <Edit2 size={10} />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteVaultFolder(f.id, f.name)}
                                              className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400"
                                              title="Delete Folder"
                                            >
                                              <Trash2 size={10} />
                                            </button>
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold text-white group-hover:text-amber-300 truncate">{f.name}</p>
                                          <p className="text-[9px] text-slate-400">{noteCount} {noteCount === 1 ? 'note' : 'notes'}</p>
                                        </div>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Section Header: Notes List */}
                            <div className="flex items-center justify-between px-1 pt-1">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                {activeVaultFolder ? `Notes in "${activeVaultFolder.name}"` : 'Notes'} ({currentNotes.length})
                              </span>
                            </div>

                            {/* List of notes */}
                            <Reorder.Group 
                              axis="y" 
                              values={vaultNotes} 
                              onReorder={handleReorderNotes}
                              className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1"
                            >
                              {currentNotes.map(note => {
                                const isActive = selectedNoteId === note.id;
                                return (
                                  <Reorder.Item
                                    key={note.id}
                                    value={note}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => {
                                      setSelectedNoteId(note.id);
                                      setNoteEditMode(true);
                                    }}
                                    onMouseDown={(e) => {
                                      const x = e.clientX;
                                      const y = e.clientY;
                                      holdTimerRef.current = setTimeout(() => {
                                        setVaultItemHoldMenu({ noteId: note.id, x, y });
                                      }, 1500);
                                    }}
                                    onMouseUp={() => clearTimeout(holdTimerRef.current)}
                                    onMouseLeave={() => clearTimeout(holdTimerRef.current)}
                                    onTouchStart={(e) => {
                                      const x = e.touches[0].clientX;
                                      const y = e.touches[0].clientY;
                                      holdTimerRef.current = setTimeout(() => {
                                        setVaultItemHoldMenu({ noteId: note.id, x, y });
                                      }, 1500);
                                    }}
                                    onTouchEnd={() => clearTimeout(holdTimerRef.current)}
                                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between relative cursor-grab active:cursor-grabbing ${isActive ? 'bg-indigo-600/20 border-indigo-500/40 text-white shadow-sm ring-1 ring-indigo-500/30' : 'border-white/5 bg-slate-900/40 hover:bg-white/5 text-slate-300'}`}
                                  >
                                    {(note as any).isPinned && <Pin className="w-2.5 h-2.5 text-amber-400 absolute top-1 right-1 rotate-45" />}
                                    <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                                      <span className="text-sm flex-shrink-0">{note.icon || '📝'}</span>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold truncate leading-snug">{note.title || 'Untitled Note'}</p>
                                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                          <span className="text-[8px] uppercase tracking-wider font-extrabold text-indigo-400 bg-indigo-500/10 px-1 py-0.2 rounded">
                                            {note.subject}
                                          </span>
                                          {note.collabCode && (
                                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20 flex items-center gap-0.5">
                                              <span>🤝</span> {note.collabCode}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <span className={`text-[10px] transition-transform ${isActive ? 'translate-x-0.5 opacity-100 text-indigo-400 font-bold' : 'opacity-0'}`}>●</span>
                                  </Reorder.Item>
                                );
                              })}

                              {currentNotes.length === 0 && (
                                <div className="text-center py-8 text-xs text-slate-500 font-medium bg-slate-950/40 rounded-2xl border border-dashed border-white/5 p-4">
                                  {activeVaultFolder 
                                    ? `Folder "${activeVaultFolder.name}" has no notes yet.`
                                    : 'No notes at root. Click "+ New Note" to write.'}
                                </div>
                              )}
                            </Reorder.Group>
                          </>
                        );
                      })()}
                    </div>

                    {/* Center Column: Clean Writing Surface (Notion/Obsidian style) */}
                    <div className={`${showNoteOutline ? 'lg:col-span-6' : 'lg:col-span-9'} space-y-4`}>
                      {(() => {
                        const activeNote = vaultNotes.find(n => n.id === selectedNoteId);
                        if (!activeNote) {
                          return (
                            <div className="smart-glass p-12 rounded-3xl text-center space-y-4 border border-dashed border-white/5">
                              <span className="text-5xl block animate-bounce">📝</span>
                              <h3 className="text-lg font-black font-display text-white">Select or Initialize a Note</h3>
                              <p className="text-xs text-slate-400 max-w-md mx-auto">Access, write, and format clean markdown with slash commands, equations, and live preview. Select a note from the left explorer or start a new page.</p>
                              <button 
                                onClick={handleCreateNewNote}
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow active:scale-95 cursor-pointer"
                              >
                                🚀 Initialize New Page
                              </button>
                            </div>
                          );
                        }

                        // Character & Word Counter
                        const charCount = activeNote.content.length;
                        const wordCount = activeNote.content.trim() === '' ? 0 : activeNote.content.trim().split(/\s+/).length;
                        const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

                        // Dynamically parse headings for Table of Contents
                        const parsedHeadings: { level: number; text: string; id: string }[] = [];
                        const lines = activeNote.content.split('\n');
                        lines.forEach((line, idx) => {
                          const h1Match = line.match(/^#\s+(.+)/);
                          const h2Match = line.match(/^##\s+(.+)/);
                          const h3Match = line.match(/^###\s+(.+)/);
                          if (h1Match) parsedHeadings.push({ level: 1, text: h1Match[1], id: `h-${idx}` });
                          else if (h2Match) parsedHeadings.push({ level: 2, text: h2Match[1], id: `h-${idx}` });
                          else if (h3Match) parsedHeadings.push({ level: 3, text: h3Match[1], id: `h-${idx}` });
                        });

                        // Autosave updater with state indicator
                        const updateActiveNote = async (updates: Partial<VaultNote>) => {
                          setAutoSaveState('saving');
                          const updated = { ...activeNote, ...updates };
                          setVaultNotes(prev => prev.map(n => n.id === activeNote.id ? updated : n));
                          try {
                            await saveVaultNoteToSupabase(updated);
                          } catch (_) {}
                          setTimeout(() => setAutoSaveState('saved'), 400);
                        };

                        const handleToolbarInject = (prefix: string, suffix = '') => {
                          const textarea = document.getElementById('notion-editor-textarea') as HTMLTextAreaElement;
                          if (!textarea) return;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const text = textarea.value;
                          const before = text.substring(0, start);
                          const after = text.substring(end, text.length);
                          const selected = text.substring(start, end) || 'Text';
                          const replacement = before + prefix + selected + suffix + after;
                          updateActiveNote({ content: replacement });
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
                          }, 50);
                        };

                        const slashCommands = [
                          { label: 'Heading 1', desc: 'Large title heading', icon: 'H1', action: () => handleToolbarInject('# ', '\n') },
                          { label: 'Heading 2', desc: 'Section heading', icon: 'H2', action: () => handleToolbarInject('## ', '\n') },
                          { label: 'Heading 3', desc: 'Sub-section heading', icon: 'H3', action: () => handleToolbarInject('### ', '\n') },
                          { label: 'Bullet List', desc: 'Simple bulleted list', icon: '•', action: () => handleToolbarInject('- ', '') },
                          { label: 'Numbered List', desc: 'Numbered sequential list', icon: '1.', action: () => handleToolbarInject('1. ', '') },
                          { label: 'Checklist', desc: 'Interactive task checklist', icon: '☑', action: () => handleToolbarInject('- [ ] ', '') },
                          { label: 'Code Block', desc: 'Syntax highlighted code', icon: '</>', action: () => handleToolbarInject('```typescript\n', '\n```') },
                          { label: 'LaTeX Math', desc: 'Mathematical derivation block', icon: '∑', action: () => handleToolbarInject('$$\n', '\n$$') },
                          { label: 'Quote', desc: 'Indented blockquote', icon: '“', action: () => handleToolbarInject('> ', '') },
                          { label: 'Callout Box', desc: 'Highlighted takeaway card', icon: '💡', action: () => handleToolbarInject('> 💡 **Key Takeaway**: ', '') },
                          { label: 'Table', desc: '2x2 Markdown table', icon: '▦', action: () => handleToolbarInject('\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n', '') },
                          { label: 'Divider', desc: 'Horizontal visual rule', icon: '—', action: () => handleToolbarInject('\n---\n', '') },
                        ];

                        const filteredCommands = slashCommands.filter(c => 
                          !slashMenuFilter.trim() || 
                          c.label.toLowerCase().includes(slashMenuFilter.toLowerCase()) ||
                          c.desc.toLowerCase().includes(slashMenuFilter.toLowerCase())
                        );

                        return (
                          <div className="smart-glass rounded-3xl overflow-hidden border border-white/10 shadow-lg bg-slate-900/50 relative">
                            
                            {/* Rich Theme Cover Gradient Banner */}
                            <div className={`h-24 ${activeNote.coverBg || 'bg-gradient-to-r from-violet-600 to-indigo-900'} relative transition-all duration-500 flex items-end justify-between px-6 pb-2`}>
                              <div className="absolute top-2.5 right-3 flex items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10 backdrop-blur-md">
                                {[
                                  'bg-gradient-to-r from-violet-600 to-indigo-900',
                                  'bg-gradient-to-r from-emerald-600 to-teal-900',
                                  'bg-gradient-to-r from-rose-600 to-amber-900',
                                  'bg-gradient-to-r from-cyan-600 to-blue-900',
                                  'bg-gradient-to-r from-slate-700 to-slate-900'
                                ].map((grad, gIdx) => (
                                  <button
                                    key={gIdx}
                                    onClick={() => updateActiveNote({ coverBg: grad })}
                                    className={`h-3.5 w-3.5 rounded-full border border-white/20 hover:scale-110 active:scale-95 transition-all ${grad} ${activeNote.coverBg === grad ? 'ring-2 ring-indigo-400 border-white' : ''}`}
                                    title="Switch cover theme"
                                  />
                                ))}
                              </div>
                              
                              <p className="text-[9px] font-black uppercase text-white/60 tracking-wider">Notion Study Canvas • Auto-synchronized</p>
                            </div>

                            {/* Main Document Body */}
                            <div className="p-5 sm:p-6 space-y-4">
                              
                              {/* Header & Title */}
                              <div className="space-y-3 relative -mt-12">
                                <div className="flex items-center justify-between gap-3">
                                  {/* Emoji picker */}
                                  <div className="inline-block relative group">
                                    <div className="h-12 w-12 rounded-2xl bg-slate-950 border-2 border-white/10 text-2xl flex items-center justify-center cursor-pointer shadow-lg hover:border-indigo-500 transition-colors">
                                      {activeNote.icon || '📝'}
                                    </div>
                                    <div className="absolute top-14 left-0 hidden group-hover:grid grid-cols-6 gap-1 p-2 rounded-xl bg-slate-950 border border-white/10 shadow-2xl z-30 w-44">
                                      {['📝', '🚀', '💡', '💻', '🧠', '🧪', '🧬', '🔬', '📐', '🎨', '🏖️', '📚'].map(emoji => (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={() => {
                                            updateActiveNote({ icon: emoji });
                                            showNotification(`Icon updated to ${emoji}`);
                                          }}
                                          className="h-6 w-6 rounded hover:bg-white/10 text-xs transition-colors flex items-center justify-center cursor-pointer"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Top Status Indicators: Autosave & Collab */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Autosave status pill */}
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
                                      autoSaveState === 'saving'
                                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    }`}>
                                      {autoSaveState === 'saving' ? (
                                        <><span>⏳</span> Saving...</>
                                      ) : (
                                        <><span>✓</span> Saved</>
                                      )}
                                    </span>

                                    {/* Collab Button */}
                                    {activeNote.collabCode ? (
                                      <button
                                        onClick={() => setActiveNoteCollabModalOpen(true)}
                                        className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                        title="View Collab Code & Share"
                                      >
                                        <Users2 className="w-3 h-3 text-emerald-400" />
                                        <span>Collab Code: {activeNote.collabCode}</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleOpenNoteCollab(activeNote)}
                                        className="px-2.5 py-1 rounded-full bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                        title="Start Collab & generate 6-digit code"
                                      >
                                        <Users2 className="w-3 h-3" />
                                        <span>Start Collab</span>
                                      </button>
                                    )}

                                    {/* Outline toggle button */}
                                    <button
                                      onClick={() => setShowNoteOutline(!showNoteOutline)}
                                      className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                        showNoteOutline ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/40' : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                                      }`}
                                      title="Toggle Outline Table of Contents"
                                    >
                                      <Columns className="w-3 h-3" />
                                      <span>Outline</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Title and Subject inputs */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                                  <div className="md:col-span-3">
                                    <input 
                                      type="text"
                                      value={activeNote.title}
                                      onChange={e => updateActiveNote({ title: e.target.value })}
                                      placeholder="Untitled Study Note..."
                                      className="w-full text-xl sm:text-2xl font-black font-display tracking-tight text-white border-b border-transparent focus:border-indigo-500/40 pb-1 bg-transparent focus:outline-none transition-colors"
                                    />
                                  </div>
                                  <div className="md:col-span-1">
                                    <select
                                      value={activeNote.subject}
                                      onChange={e => updateActiveNote({ subject: e.target.value })}
                                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/5 text-slate-300 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                    >
                                      {['Physics', 'Chemistry', 'Computer Science', 'Mathematics', 'Syllabus General', 'Biology', 'Geography', 'History', 'English'].map(sub => (
                                        <option key={sub} value={sub}>{sub}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              {/* Editor Toolbar & Mode Switchers */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-y border-white/5 py-2.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {/* View modes */}
                                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/5">
                                    <button
                                      onClick={() => {
                                        setNoteEditMode(true);
                                        setViewSplitPreview(false);
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                        noteEditMode && !viewSplitPreview ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      ✍️ Editor
                                    </button>
                                    <button
                                      onClick={() => {
                                        setNoteEditMode(false);
                                        setViewSplitPreview(false);
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                        !noteEditMode ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      👁️ Reader
                                    </button>
                                    <button
                                      onClick={() => {
                                        setNoteEditMode(true);
                                        setViewSplitPreview(true);
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                        viewSplitPreview ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      📑 Split View
                                    </button>
                                  </div>

                                  {/* Slash command trigger */}
                                  <button
                                    onClick={() => setSlashMenuOpen(!slashMenuOpen)}
                                    className="px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                    title="Open Slash Command Palette"
                                  >
                                    <Sparkles className="w-3 h-3 text-indigo-400" />
                                    <span>Slash / Commands</span>
                                  </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  {/* Font Switcher */}
                                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950 border border-white/5">
                                    {(['sans', 'serif', 'mono'] as const).map(font => (
                                      <button
                                        key={font}
                                        onClick={() => setNoteFont(font)}
                                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-all ${noteFont === font ? 'bg-indigo-600 font-bold text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                      >
                                        {font}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Export Buttons */}
                                  <button
                                    onClick={() => {
                                      const blob = new Blob([activeNote.content], { type: 'text/markdown' });
                                      const filename = `${activeNote.title || 'Note'}.md`;
                                      const link = document.createElement('a');
                                      link.href = URL.createObjectURL(blob);
                                      link.download = filename;
                                      link.click();
                                    }}
                                    className="px-2 py-1 rounded bg-indigo-900/30 text-indigo-400 text-[10px] font-bold hover:bg-indigo-800/40"
                                    title="Export as Markdown"
                                  >
                                    .MD
                                  </button>
                                  <button
                                    onClick={() => {
                                      generateFormattedPdf(activeNote.title, activeNote.subject, activeNote.content);
                                      showNotification('📄 Generating note PDF...');
                                    }}
                                    className="px-2 py-1 rounded bg-indigo-900/30 text-indigo-400 text-[10px] font-bold hover:bg-indigo-800/40"
                                    title="Export as PDF"
                                  >
                                    🖨️ PDF
                                  </button>
                                </div>
                              </div>

                              {/* Slash Command Palette Modal / Dropdown */}
                              <AnimatePresence>
                                {slashMenuOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    className="p-3 bg-slate-950 border border-indigo-500/30 rounded-2xl shadow-2xl space-y-2 z-20"
                                  >
                                    <div className="flex items-center justify-between pb-1 border-b border-white/5">
                                      <span className="text-[11px] font-bold uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                                        <span>⚡ Slash Commands</span>
                                      </span>
                                      <button 
                                        onClick={() => setSlashMenuOpen(false)}
                                        className="text-slate-400 hover:text-white p-0.5 rounded"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                    <input 
                                      type="text"
                                      placeholder="Filter command..."
                                      value={slashMenuFilter}
                                      onChange={e => setSlashMenuFilter(e.target.value)}
                                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                      autoFocus
                                    />
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                      {filteredCommands.map((cmd, cIdx) => (
                                        <button
                                          key={cIdx}
                                          type="button"
                                          onClick={() => {
                                            cmd.action();
                                            setSlashMenuOpen(false);
                                            setSlashMenuFilter('');
                                          }}
                                          className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/70 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/30 text-left transition-all cursor-pointer group"
                                        >
                                          <span className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-xs font-mono font-bold text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white shrink-0">
                                            {cmd.icon}
                                          </span>
                                          <div className="min-w-0">
                                            <p className="text-xs font-bold text-white group-hover:text-indigo-300 truncate">{cmd.label}</p>
                                            <p className="text-[9px] text-slate-400 truncate">{cmd.desc}</p>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Formatting toolbar buttons */}
                              <div className="flex flex-wrap items-center gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-white/5 text-[10px] text-slate-400">
                                <button onClick={() => handleToolbarInject('# ', '\n')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 font-bold">H1</button>
                                <button onClick={() => handleToolbarInject('## ', '\n')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 font-bold">H2</button>
                                <button onClick={() => handleToolbarInject('### ', '\n')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 font-bold">H3</button>
                                <div className="w-px h-3.5 bg-white/10 mx-0.5"></div>
                                <button onClick={() => handleToolbarInject('**', '**')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 font-bold" title="Bold">B</button>
                                <button onClick={() => handleToolbarInject('*', '*')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 italic" title="Italic">I</button>
                                <button onClick={() => handleToolbarInject('<mark>', '</mark>')} className="hover:text-white px-2 py-1 rounded bg-emerald-900/40 text-emerald-300" title="Highlight">HL</button>
                                <button onClick={() => handleToolbarInject('- ', '')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800">List</button>
                                <button onClick={() => handleToolbarInject('1. ', '')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800">1.2.3</button>
                                <button onClick={() => handleToolbarInject('- [ ] ', '')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800">☑ ToDo</button>
                                <div className="w-px h-3.5 bg-white/10 mx-0.5"></div>
                                <button onClick={() => handleToolbarInject('`', '`')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 font-mono">Code</button>
                                <button onClick={() => handleToolbarInject('$$\n', '\n$$')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 font-serif" title="LaTeX Math">Math $$</button>
                                <button onClick={() => handleToolbarInject('> ', '')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800">Quote</button>
                                <button onClick={() => handleToolbarInject('\n---\n')} className="hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800">Line</button>
                              </div>

                              {/* Canvas Editor: Split View or Standard Mode */}
                              {viewSplitPreview ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="relative">
                                    <textarea 
                                      id="notion-editor-textarea"
                                      rows={18}
                                      value={activeNote.content}
                                      onChange={e => updateActiveNote({ content: e.target.value })}
                                      className={`w-full px-4 py-3 bg-slate-950/70 border border-white/5 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-200 leading-relaxed resize-none ${noteFont === 'serif' ? 'font-serif' : noteFont === 'mono' ? 'font-mono' : 'font-sans'}`}
                                      placeholder="Write anything in Markdown... (Type / for quick commands)"
                                    />
                                    <span className="absolute bottom-3 right-3 text-[10px] text-slate-500 font-mono">
                                      {wordCount} words
                                    </span>
                                  </div>
                                  <div className={`p-4 rounded-2xl bg-slate-950/40 border border-white/5 text-xs text-slate-200 max-h-[440px] overflow-y-auto leading-relaxed select-text ${noteFont === 'serif' ? 'font-serif' : noteFont === 'mono' ? 'font-mono' : 'font-sans'}`}>
                                    <div className="text-[10px] font-bold uppercase text-slate-500 pb-2 mb-2 border-b border-white/5">
                                      Live Preview
                                    </div>
                                    <div className="space-y-2">
                                      {renderMarkdown(activeNote.content)}
                                    </div>
                                  </div>
                                </div>
                              ) : noteEditMode ? (
                                <div className="relative">
                                  <textarea 
                                    id="notion-editor-textarea"
                                    rows={16}
                                    value={activeNote.content}
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (val.endsWith('/') && !slashMenuOpen) {
                                        setSlashMenuOpen(true);
                                      }
                                      updateActiveNote({ content: val });
                                    }}
                                    className={`w-full px-4 py-3 bg-slate-950/70 border border-white/5 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-200 leading-relaxed resize-none ${noteFont === 'serif' ? 'font-serif' : noteFont === 'mono' ? 'font-mono' : 'font-sans'}`}
                                    placeholder="Write in clean Markdown... Type / to launch commands palette, # for headings, - for lists, $$ for LaTeX math equations..."
                                  />
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 px-1">
                                    <span>Press / for Slash Menu commands</span>
                                    <span>{wordCount} words • {charCount} chars • ~{readTimeMin}m read</span>
                                  </div>
                                </div>
                              ) : (
                                <div className={`p-6 rounded-2xl bg-slate-950/40 border border-white/5 text-xs text-slate-200 min-h-[360px] leading-relaxed select-text ${noteFont === 'serif' ? 'font-serif' : noteFont === 'mono' ? 'font-mono' : 'font-sans'}`}>
                                  <div className="space-y-2">
                                    {renderMarkdown(activeNote.content)}
                                  </div>
                                </div>
                              )}

                              {/* AI Companion Expansion Bar */}
                              <div className="bg-slate-950/60 p-3 sm:p-4 rounded-2xl border border-indigo-500/15 space-y-2.5 shadow-inner">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-indigo-400">⚡</span>
                                    <p className="text-xs font-black text-white font-display uppercase tracking-wider">AI Study Note Companion</p>
                                  </div>
                                  <span className="text-[9px] text-slate-500">Transform drafts into study summaries or quiz blocks</span>
                                </div>
                                
                                <div className="flex flex-wrap gap-1.5">
                                  <button 
                                    type="button"
                                    onClick={() => handleAINoteAction('summarize')}
                                    disabled={aiGeneratingNotes}
                                    className="px-2.5 py-1 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/30 border border-indigo-500/20 text-[10px] font-bold text-indigo-300 transition-colors disabled:opacity-40 cursor-pointer"
                                  >
                                    📝 Summarize
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleAINoteAction('expand')}
                                    disabled={aiGeneratingNotes}
                                    className="px-2.5 py-1 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/30 border border-indigo-500/20 text-[10px] font-bold text-indigo-300 transition-colors disabled:opacity-40 cursor-pointer"
                                  >
                                    🚀 Expand
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleAINoteAction('improve')}
                                    disabled={aiGeneratingNotes}
                                    className="px-2.5 py-1 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/30 border border-indigo-500/20 text-[10px] font-bold text-indigo-300 transition-colors disabled:opacity-40 cursor-pointer"
                                  >
                                    ✍️ Polish
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleAINoteAction('quiz')}
                                    disabled={aiGeneratingNotes}
                                    className="px-2.5 py-1 rounded-xl bg-purple-600/15 hover:bg-purple-600/30 border border-purple-500/20 text-[10px] font-bold text-purple-300 transition-colors disabled:opacity-40 cursor-pointer"
                                  >
                                    🧠 Quiz Block
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleAINoteAction('action_items')}
                                    disabled={aiGeneratingNotes}
                                    className="px-2.5 py-1 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/30 border border-emerald-500/20 text-[10px] font-bold text-emerald-300 transition-colors disabled:opacity-40 cursor-pointer"
                                  >
                                    📋 Action Items
                                  </button>
                                </div>
                              </div>

                              {/* Workspace page utilities */}
                              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(`Page: ${activeNote.icon || '📝'} ${activeNote.title}\nSubject: ${activeNote.subject}\n\n${activeNote.content}`);
                                    showNotification('Full page copied in Markdown format!');
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 hover:text-white transition-colors border border-white/5 active:scale-95 cursor-pointer"
                                  title="Export Note to Markdown"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Markdown</span>
                                </button>

                                <button
                                  onClick={() => {
                                    if (confirm('Delete this study note permanently?')) {
                                      setVaultNotes(prev => {
                                        const newNotes = prev.filter(n => n.id !== activeNote.id);
                                        if (currentUser?.uid) deleteVaultNoteFromSupabase(activeNote.id, currentUser.uid).catch(()=>{});
                                        return newNotes;
                                      });
                                      setSelectedNoteId(null);
                                      showNotification('Note removed from vault.');
                                    }
                                  }}
                                  className="flex items-center gap-1 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors text-[10px] font-semibold active:scale-95 cursor-pointer"
                                  title="Trash note permanently"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete Page</span>
                                </button>
                              </div>

                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right Column: Dynamic Outline (TOC) & Insights */}
                    {showNoteOutline && (
                      <div className="lg:col-span-3 smart-glass p-4 rounded-3xl space-y-4 border border-white/5 sticky top-4">
                        {(() => {
                          const activeNote = vaultNotes.find(n => n.id === selectedNoteId);
                          if (!activeNote) {
                            return (
                              <div className="text-center py-8 text-xs text-slate-500">
                                Select a note to view outline
                              </div>
                            );
                          }

                          const wordCount = activeNote.content.trim() === '' ? 0 : activeNote.content.trim().split(/\s+/).length;
                          const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

                          // Parse Headings
                          const headings: { level: number; text: string }[] = [];
                          const contentLines = activeNote.content.split('\n');
                          contentLines.forEach(line => {
                            const m1 = line.match(/^#\s+(.+)/);
                            const m2 = line.match(/^##\s+(.+)/);
                            const m3 = line.match(/^###\s+(.+)/);
                            if (m1) headings.push({ level: 1, text: m1[1] });
                            else if (m2) headings.push({ level: 2, text: m2[1] });
                            else if (m3) headings.push({ level: 3, text: m3[1] });
                          });

                          return (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <h3 className="text-xs font-black text-white font-display uppercase tracking-wider flex items-center gap-1.5">
                                  <span>📑 Outline (TOC)</span>
                                </h3>
                                <button
                                  onClick={() => setShowNoteOutline(false)}
                                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5"
                                  title="Close Outline"
                                >
                                  <X size={12} />
                                </button>
                              </div>

                              {/* Document Metrics */}
                              <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Words</p>
                                  <p className="text-sm font-black text-indigo-400 font-mono">{wordCount}</p>
                                </div>
                                <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Read Time</p>
                                  <p className="text-sm font-black text-purple-400 font-mono">~{readTimeMin}m</p>
                                </div>
                              </div>

                              {/* Hierarchical Headings Tree */}
                              <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
                                {headings.length === 0 ? (
                                  <div className="text-center py-6 text-[11px] text-slate-500 px-2 bg-slate-950/30 rounded-xl border border-dashed border-white/5">
                                    Type # Heading or ## Section in your note to automatically build an interactive outline.
                                  </div>
                                ) : (
                                  headings.map((h, hIdx) => (
                                    <div
                                      key={hIdx}
                                      className={`text-xs py-1 px-2 rounded-lg transition-colors truncate ${
                                        h.level === 1
                                          ? 'font-bold text-white bg-white/5'
                                          : h.level === 2
                                            ? 'pl-4 text-slate-300 font-semibold hover:bg-white/5'
                                            : 'pl-7 text-[11px] text-slate-400 hover:bg-white/5'
                                      }`}
                                      title={h.text}
                                    >
                                      <span className="text-indigo-400 font-mono mr-1.5">{'#'.repeat(h.level)}</span>
                                      <span>{h.text}</span>
                                    </div>
                                  ))
                                )}
                              </div>

                              {/* Quick Syntax Shortcuts */}
                              <div className="pt-2 border-t border-white/5 space-y-1 text-[10px] text-slate-400">
                                <p className="font-bold uppercase text-slate-500 tracking-wider text-[9px]">Markdown Cheat-Sheet</p>
                                <div className="flex flex-wrap gap-1">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-white/5 font-mono"># H1</span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-white/5 font-mono">**bold**</span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-white/5 font-mono">- [ ] todo</span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-white/5 font-mono">$$ math $$</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                  </div>

                  {/* Modal 1: Collab 6-Digit Code Dialog (for creator / viewer) */}
                  <AnimatePresence>
                    {activeNoteCollabModalOpen && (() => {
                      const note = vaultNotes.find(n => n.id === selectedNoteId);
                      if (!note) return null;
                      return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
                          <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-md smart-glass p-6 rounded-3xl border border-indigo-500/30 shadow-2xl space-y-4"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                              <div className="flex items-center gap-2">
                                <Users2 className="w-5 h-5 text-indigo-400" />
                                <h3 className="text-base font-black text-white">Peer Note Collaboration</h3>
                              </div>
                              <button
                                onClick={() => setActiveNoteCollabModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white"
                              >
                                <X size={16} />
                              </button>
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed">
                              Share this 6-digit code with your classmates. Anyone who enters this code in <span className="text-indigo-400 font-bold">Join Note</span> will open and sync this note with you.
                            </p>

                            <div className="p-5 rounded-2xl bg-slate-950 border border-indigo-500/40 text-center space-y-1 shadow-inner">
                              <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Collaboration Code</p>
                              <p className="text-4xl font-black font-mono tracking-widest text-indigo-400 select-all py-1">
                                {note.collabCode}
                              </p>
                              <p className="text-[10px] text-emerald-400 font-bold">🔒 Private to users with code</p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(note.collabCode || '');
                                    showNotification('✓ Copied 6-digit code to clipboard!');
                                  }
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                              >
                                <Copy className="w-4 h-4" />
                                <span>Copy 6-Digit Code</span>
                              </button>
                              <button
                                onClick={() => setActiveNoteCollabModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
                              >
                                Done
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      );
                    })()}
                  </AnimatePresence>

                  {/* Modal 2: Join Note by 6-Digit Code Dialog */}
                  <AnimatePresence>
                    {collabJoinModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.95, opacity: 0 }}
                          className="w-full max-w-md smart-glass p-6 rounded-3xl border border-indigo-500/30 shadow-2xl space-y-4"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <div className="flex items-center gap-2">
                              <Users2 className="w-5 h-5 text-indigo-400" />
                              <h3 className="text-base font-black text-white">Join Shared Note</h3>
                            </div>
                            <button
                              onClick={() => {
                                setCollabJoinModalOpen(false);
                                setCollabJoinError('');
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-white"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">
                            Enter the 6-digit collaboration code provided by your peer or faculty to join and sync their lecture note.
                          </p>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">6-Digit Code</label>
                            <input 
                              type="text"
                              maxLength={6}
                              placeholder="e.g. 583921"
                              value={collabJoinCodeInput}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                setCollabJoinCodeInput(val);
                                setCollabJoinError('');
                              }}
                              onKeyDown={e => e.key === 'Enter' && handleJoinNoteByCode(collabJoinCodeInput)}
                              className="w-full text-center text-2xl font-mono font-black tracking-widest px-4 py-3 rounded-2xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                          </div>

                          {collabJoinError && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 font-medium"
                            >
                              ⚠️ {collabJoinError}
                            </motion.div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleJoinNoteByCode(collabJoinCodeInput)}
                              disabled={collabJoinLoading || collabJoinCodeInput.length !== 6}
                              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/40 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                            >
                              {collabJoinLoading ? (
                                <>
                                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                  <span>Joining...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  <span>Join Note</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setCollabJoinModalOpen(false);
                                setCollabJoinError('');
                              }}
                              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                    </>
                  )}
                </div>
              )}

              {/* Tab: Focus Timer — Distraction-Free Productivity Engine */}
              {activeTab === 'pomodoro' && (() => {
                const totalDuration = Math.max(1, customPomodoro);
                const progressRatio = Math.min(1, Math.max(0, (totalDuration - pomodoroSeconds) / totalDuration));
                const radius = 112;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference * (1 - progressRatio);
                const hrs = Math.floor(pomodoroSeconds / 3600);
                const mins = Math.floor((pomodoroSeconds % 3600) / 60);
                const secs = pomodoroSeconds % 60;
                const timeFormatted = `${hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                const isAtStart = pomodoroSeconds === customPomodoro;

                const applyPreset = (mode: 'focus' | 'short_break' | 'long_break', seconds: number) => {
                  soundService.playButtonClick();
                  if (pomodoroRunning) setPomodoroRunning(false);
                  setPomodoroMode(mode);
                  setCustomPomodoro(seconds);
                  setPomodoroSeconds(seconds);
                  setPomodoroJustCompleted(false);
                  setShowPomodoroSettings(false);
                };

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="bento-card p-6 sm:p-8 rounded-3xl space-y-6 max-w-2xl mx-auto text-center relative overflow-hidden"
                  >
                    <BorderBeam size={220} duration={12} colorFrom="#6366f1" colorTo="#14b8a6" />
                    {/* Top Header & Today's Session Counter */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-white/10 pb-4 text-left relative z-10">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Focus Timer</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400">
                            {pomodoroMode === 'focus' ? 'Deep Work Session' : pomodoroMode === 'short_break' ? 'Short Rest' : 'Long Recovery'}
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight mt-0.5">
                          Distraction-Free Study Timer
                        </h2>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-300 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-white/10 shrink-0">
                        <span>Sessions today: <strong className="text-white font-mono tabular-nums"><NumberTicker value={pomodoroCompletedCount} /></strong></span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-emerald-400 font-semibold">+50 XP / focus</span>
                      </div>
                    </div>

                    {/* Compact Mode & Duration Presets */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/80 border border-white/10 max-w-lg mx-auto">
                      {[
                        { mode: 'focus' as const, label: '25m Focus', sec: 1500 },
                        { mode: 'focus' as const, label: '45m Deep Work', sec: 2700 },
                        { mode: 'short_break' as const, label: '5m Break', sec: 300 },
                        { mode: 'long_break' as const, label: '15m Long Break', sec: 900 }
                      ].map((preset) => {
                        const active = !showPomodoroSettings && pomodoroMode === preset.mode && customPomodoro === preset.sec;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => applyPreset(preset.mode, preset.sec)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                              active
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setPomodoroRunning(false);
                          setShowPomodoroSettings(prev => !prev);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          showPomodoroSettings
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        Custom
                      </button>
                    </div>

                    {/* Main Circular Progress Timer Visualization */}
                    <div className="py-4 flex flex-col items-center justify-center relative">
                      <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 256 256">
                          <circle
                            cx="128"
                            cy="128"
                            r={radius}
                            fill="transparent"
                            stroke="currentColor"
                            strokeWidth="8"
                            className="text-slate-800/80"
                          />
                          <circle
                            cx="128"
                            cy="128"
                            r={radius}
                            fill="transparent"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            className={`transition-all duration-300 ${
                              pomodoroJustCompleted
                                ? 'text-emerald-400'
                                : pomodoroMode === 'focus'
                                ? 'text-indigo-500'
                                : 'text-teal-400'
                            }`}
                          />
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 select-none">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {pomodoroJustCompleted
                              ? 'Completed'
                              : pomodoroRunning
                              ? pomodoroMode === 'focus'
                                ? 'Focusing'
                                : 'On Break'
                              : isAtStart
                              ? 'Ready'
                              : 'Paused'}
                          </span>
                          <div className="text-4xl sm:text-5xl font-black font-mono tabular-nums tracking-tight text-white mt-1">
                            {timeFormatted}
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono tabular-nums mt-1.5">
                            {Math.round(progressRatio * 100)}% elapsed
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Custom Duration Drawer */}
                    <AnimatePresence>
                      {showPomodoroSettings && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-slate-950/90 p-4 rounded-2xl border border-white/10 max-w-sm mx-auto space-y-3">
                            <p className="text-xs font-bold text-white">Custom Duration</p>
                            <div className="flex justify-center items-center gap-2">
                              <div className="flex flex-col">
                                <label className="text-[10px] text-slate-400 font-semibold mb-1">Hours</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="12"
                                  value={timerH}
                                  onChange={e => setTimerH(Math.max(0, Number(e.target.value)))}
                                  className="w-16 px-2 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-center text-white font-mono text-xs"
                                />
                              </div>
                              <span className="text-lg font-bold text-slate-500 mt-4">:</span>
                              <div className="flex flex-col">
                                <label className="text-[10px] text-slate-400 font-semibold mb-1">Minutes</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={timerM}
                                  onChange={e => setTimerM(Math.max(0, Math.min(59, Number(e.target.value))))}
                                  className="w-16 px-2 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-center text-white font-mono text-xs"
                                />
                              </div>
                              <span className="text-lg font-bold text-slate-500 mt-4">:</span>
                              <div className="flex flex-col">
                                <label className="text-[10px] text-slate-400 font-semibold mb-1">Seconds</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={timerS}
                                  onChange={e => setTimerS(Math.max(0, Math.min(59, Number(e.target.value))))}
                                  className="w-16 px-2 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-center text-white font-mono text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const totalSec = Math.max(10, (timerH * 3600) + (timerM * 60) + timerS);
                                  setCustomPomodoro(totalSec);
                                  setPomodoroSeconds(totalSec);
                                  setPomodoroJustCompleted(false);
                                  setShowPomodoroSettings(false);
                                  showNotification('Custom timer duration saved.');
                                }}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 rounded-xl py-2 text-xs font-bold text-white cursor-pointer"
                              >
                                Apply Duration
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowPomodoroSettings(false)}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Session Completion Feedback Banner */}
                    {pomodoroJustCompleted && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-white">
                              {pomodoroMode === 'focus'
                                ? 'Focus session complete! +50 House Points earned.'
                                : 'Break session complete! Ready to resume study.'}
                            </p>
                            <p className="text-[11px] text-slate-300">
                              {pomodoroMode === 'focus'
                                ? 'Take a short 5-minute break to recharge before your next block.'
                                : 'Start a 25-minute focus block when you are ready.'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (pomodoroMode === 'focus') {
                              applyPreset('short_break', 300);
                              setPomodoroRunning(true);
                            } else {
                              applyPreset('focus', 1500);
                              setPomodoroRunning(true);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer"
                        >
                          {pomodoroMode === 'focus' ? 'Start 5m Break →' : 'Start 25m Focus →'}
                        </button>
                      </motion.div>
                    )}

                    {/* Primary Timer Controls */}
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      {!pomodoroRunning ? (
                        <button
                          type="button"
                          onClick={() => {
                            soundService.playButtonClick();
                            soundService.playShortDigitalAlert();
                            if (pomodoroSeconds <= 0) {
                              setPomodoroSeconds(customPomodoro);
                            }
                            setPomodoroJustCompleted(false);
                            pomodoroEndTimeRef.current = Date.now() + (pomodoroSeconds > 0 ? pomodoroSeconds : customPomodoro) * 1000;
                            setPomodoroRunning(true);
                          }}
                          className="uiverse-btn-primary px-8 py-3 rounded-xl text-white font-bold text-xs sm:text-sm cursor-pointer min-w-[140px]"
                        >
                          {isAtStart || pomodoroSeconds <= 0 ? 'Start Session' : 'Resume'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            soundService.playButtonClick();
                            setPomodoroRunning(false);
                          }}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 py-3 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer min-w-[140px]"
                        >
                          Pause
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          soundService.playButtonClick();
                          setPomodoroRunning(false);
                          pomodoroEndTimeRef.current = null;
                          setPomodoroSeconds(customPomodoro);
                          setPomodoroJustCompleted(false);
                          localStorage.removeItem('s_os_pomodoro_active_state');
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 font-bold px-5 py-3 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Tab: Performance Analytics (Unified Overview, Gradebook, Report Cards, and Attendance) */}
              {(activeTab === 'analytics' || activeTab === 'gradebook' || activeTab === 'report_cards') && (
                <PerformanceAnalytics 
                  key={`${currentUser?.uid || 'guest'}-${activeTab}`}
                  currentUser={currentUser} 
                  effectiveRole={effectiveRole} 
                  initialSubTab={activeTab === 'gradebook' ? 'gradebook' : activeTab === 'report_cards' ? 'report_cards' : 'overview'}
                />
              )}

              {/* Tab: Student/Staff Profile View */}
              {activeTab === 'profile' && (
                <div className="smart-glass p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 max-w-4xl mx-auto animate-fadeIn col-span-2">
                  <div className="space-y-2">
                    <h3 className="text-xl sm:text-2xl font-black font-display text-white">{getUserProfileTitle(currentUser, effectiveRole)} Profile</h3>
                    <p className="text-xs text-slate-400">Manage your presence, identity, and view your dashboard.</p>
                  </div>

                  {effectiveRole === 'teacher' ? (
                     <TeacherProfile 
                       currentUser={currentUser} 
                       handleSaveProfile={handleSaveProfile} 
                       profileNameInput={profileNameInput} 
                       setProfileNameInput={setProfileNameInput} 
                       profileAvatar={profileAvatar} 
                       setProfileAvatar={setProfileAvatar} 
                       profileTab={profileTab} 
                       setProfileTab={setProfileTab}
                       onProfileUpdated={(updated: any) => {
                         setCurrentUser(updated);
                         try { localStorage.setItem('s_os_user', JSON.stringify(updated)); } catch (_) {}
                         showNotification('✨ Profile card updated successfully!');
                       }} 
                     />
                  ) : (
                    <>
                      {/* Profile Navigation Dropdown */}
                      <div className="mb-6 relative z-20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-slate-950/80 border border-white/10 rounded-2xl">
                          <div className="w-full sm:max-w-md">
                            <ProfessionalTabDropdown
                              options={
                                effectiveRole === 'student' ? [
                                  { id: 'overview', label: 'Profile Overview', icon: '👤', description: 'Academic identity & house verification' },
                                  { id: 'settings', label: 'Settings & Themes', icon: '⚙️', description: 'Custom cards, themes and preferences' },
                                  { id: 'attendance', label: 'Attendance Records', icon: '📅', description: 'Term presence & excused records' },
                                  { id: 'records', label: 'Academic Records', icon: '📜', description: 'Official marks & subject assessments' },
                                  { id: 'remarks', label: 'Faculty Remarks', icon: '💬', description: 'Teacher observations & behavioral notes' },
                                  { id: 'analytics', label: 'AI Study Analytics', icon: '✨', description: 'Predictive performance and strengths' }
                                ] : effectiveRole === 'coordinator' ? [
                                  { id: 'overview', label: 'Coordinator Overview', icon: '👤', description: 'Faculty presence and cohort profile' },
                                  { id: 'settings', label: 'Settings & Studio', icon: '⚙️', description: 'Profile personalization & system tools' },
                                  { id: 'teacher_list', label: 'Faculty Directory', icon: '👩‍🏫', description: 'Manage assigned teachers and classes' },
                                  { id: 'student_list', label: 'Student Directory', icon: '🎓', description: 'Inspect student rosters and sections' },
                                  { id: 'house_reports', label: 'House Reports', icon: '🏠', description: 'Inter-house standings and points' },
                                  { id: 'section_reports', label: 'Section Reports', icon: '📊', description: 'Curriculum coverage and averages' },
                                  { id: 'requests', label: 'Pending Approvals', icon: '⏳', description: 'Verification queues and role requests' }
                                ] : [
                                  { id: 'overview', label: 'Administrator Overview', icon: '🛡️', description: 'Master institutional profile' },
                                  { id: 'settings', label: 'System Settings', icon: '⚙️', description: 'Institutional controls & customization' },
                                  { id: 'students', label: 'Student Management', icon: '🎓', description: 'Student directory and section mappings' },
                                  { id: 'teachers', label: 'Teacher Management', icon: '👩‍🏫', description: 'Faculty subject assignments and roles' },
                                  { id: 'coordinators', label: 'Coordinator Roster', icon: '📋', description: 'Department leads and overseers' },
                                  { id: 'reports', label: 'Administrative Reports', icon: '📈', description: 'School-wide analytics and audit summaries' },
                                  { id: 'requests', label: 'Pending Approvals', icon: '⏳', description: 'Role elevation and registration requests' }
                                ]
                              }
                              selectedId={profileTab === 'customizer' ? 'settings' : profileTab}
                              onSelect={(id) => setProfileTab(id as any)}
                              size="md"
                            />
                          </div>
                          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-300">
                            <span className="text-slate-500 font-medium">Viewing Section:</span>
                            <span className="font-bold text-indigo-400 capitalize">
                              {(profileTab === 'customizer' ? 'settings' : profileTab).replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {(profileTab === 'settings' || profileTab === 'customizer') && currentUser && (
                        <div className="animate-fadeIn">
                          <ProfileSettings 
                            currentUser={currentUser}
                            initialSubSection={profileTab === 'customizer' ? 'customization' : 'notifications'}
                            onUpdateUser={(updated) => {
                              setCurrentUser(updated);
                              try { localStorage.setItem('s_os_user', JSON.stringify(updated)); } catch (_) {}
                            }}
                            onProfileUpdated={(updated) => {
                              setCurrentUser(updated);
                              try { localStorage.setItem('s_os_user', JSON.stringify(updated)); } catch (_) {}
                              showNotification('✨ Settings and profile updated successfully!');
                            }} 
                          />
                        </div>
                      )}

                      {profileTab === 'overview' && (
                        <form onSubmit={handleSaveProfile} className="space-y-6 animate-fadeIn">
                          {effectiveRole === 'student' && (
                            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold">
                              <span>🔒</span>
                              <p>Profile details are locked. Only Teachers, Coordinators, and Admins can modify your core details, including your assigned House and Section.</p>
                            </div>
                          )}
                          <div className="flex flex-col sm:flex-row items-center gap-5 p-5 bg-white/5 rounded-2xl border border-white/5">
                            {profileAvatar ? (
                              <img 
                                src={profileAvatar} 
                                alt="Profile Avatar" 
                                className="w-20 h-20 rounded-2xl border-2 border-indigo-500 object-cover shadow-md"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-2xl border-2 border-indigo-500 bg-slate-800 flex items-center justify-center font-black font-mono text-indigo-400 text-xl">
                                {currentUser?.name ? currentUser.name.split(',').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
                              </div>
                            )}
                            <div className="space-y-2 text-center sm:text-left flex-1">
                              <label className="text-[11px] font-bold text-slate-400 block p-0.5 mb-1.5 uppercase tracking-wider">Profile Picture Integration</label>
                              <div className="flex flex-wrap gap-2 justify-center sm:justify-start items-center">
                                {/* Upload Button */}
                                <label className="cursor-pointer py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all">
                                  📁 Choose File
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={async (e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        const file = e.target.files[0];
                                        try {
                                          showNotification('Uploading profile picture to storage...');
                                          const { url } = await uploadFileToStorage(file, 'users');
                                          setProfileAvatar(url);
                                          showNotification('✓ Profile image selected! Click save below to sync changes.');
                                        } catch (err: any) {
                                          showNotification(`❌ Upload failed: ${err.message || String(err)}`);
                                        }
                                      }
                                    }}
                                  />
                                </label>
                                
                                {/* Remove Button */}
                                {profileAvatar && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProfileAvatar('');
                                      showNotification('Profile picture cleared. Click save below to sync changes.');
                                    }}
                                    className="py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                  >
                                    🗑️ Remove Picture
                                  </button>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500">Supports PNG, JPG, or WEBP images uploaded to secure school storage.</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400">Full Identity Name</label>
                          <input 
                            type="text"
                            value={profileNameInput}
                            disabled={effectiveRole === 'student'}
                            onChange={e => {
                              const val = e.target.value;
                              setProfileNameInput(val);
                              if (val && !/^[A-Za-z\s]+$/.test(val)) {
                                setProfileNameError('❌ Numbers and symbols are not allowed in Full Name');
                              } else {
                                setProfileNameError('');
                              }
                            }}
                            className={`w-full text-sm px-4 py-3 rounded-xl bg-slate-900 border ${profileNameError ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : 'border-white/10 focus:ring-indigo-500'} text-white focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                            required
                          />
                          {profileNameError && <p className="text-red-500 text-[10px] font-bold mt-1">{profileNameError}</p>}
                        </div>

                        {effectiveRole === 'student' ? (
                          <>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-400">Class Level / Academic Stream</label>
                              <select 
                                value={profileGradeInput}
                                disabled={true}
                                onChange={e => setProfileGradeInput(e.target.value)}
                                className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`).map((g) => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-400">Official House Alliance</label>
                              <select 
                                value={profileHouseInput}
                                disabled={true}
                                onChange={e => setProfileHouseInput(e.target.value as HouseType)}
                                className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <option value="Ruby">Ruby House (Crimson)</option>
                                <option value="Emerald">Emerald House (Green)</option>
                                <option value="Sapphire">Sapphire House (Blue)</option>
                                <option value="Topaz">Topaz House (Gold)</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-400">Assigned Classroom Section</label>
                              <select 
                                value={profileSectionInput}
                                disabled={true}
                                onChange={e => setProfileSectionInput(e.target.value as SectionType)}
                                className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <option value="Astra">Astra (Alpha)</option>
                                <option value="Elara">Elara (Beta)</option>
                                <option value="Solara">Solara (Gamma)</option>
                                <option value="Vega">Vega (Delta)</option>
                              </select>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-400">Assigned Classes (Read-Only)</label>
                              <div className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900/50 border border-white/5 text-slate-300">
                                {(currentUser.assignedGrades || []).join('') || 'None Assigned'}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-400">Assigned Sections (Read-Only)</label>
                              <div className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900/50 border border-white/5 text-slate-300">
                                {(currentUser.assignedSections || []).join('') || 'None Assigned'}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-400">Role</label>
                              <div className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900/50 border border-white/5 text-slate-300 uppercase">
                                {effectiveRole}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-4 flex-wrap">
                        <button 
                          type="submit"
                          disabled={!!profileNameError}
                          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                        >
                          {effectiveRole === 'student' ? 'Update Profile Picture' : 'Update Profile Parameters'}
                        </button>
                      </div>

                      {/* App Download and Installation Section */}
                      <div className="mt-8 pt-6 border-t border-white/5">
                        <AppInstallSection 
                          isSuperAdmin={Boolean(isSuperAdmin || effectiveRole === 'super_admin' || currentUser?.role === 'super_admin')}
                          effectiveRole={effectiveRole || currentUser?.role || 'student'}
                          currentUserName={currentUser?.name || currentUser?.email || 'Super Admin'}
                        />
                      </div>
                    </form>
                  )}
                  
                  {profileTab === 'attendance' && (
                    <StudentAttendanceView currentUser={currentUser} />
                  )}

                  {profileTab === 'records' && (
                    <div className="animate-fadeIn space-y-4">
                      <div className="p-6 bg-slate-950/50 border border-white/5 rounded-2xl">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-lg font-bold text-white">Report Cards & Marks</h4>
                          <span className="bg-indigo-500 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full">Term 1</span>
                        </div>
                        
                        <div className="overflow-x-hidden">
                          {/* Desktop Table */}
                          <div className="hidden sm:block">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
                                <tr>
                                  <th className="p-3">Subject</th>
                                  <th className="p-3">Class Test</th>
                                  <th className="p-3">Mid Term</th>
                                  <th className="p-3">Grade</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 text-slate-300">
                                <tr><td className="p-3 font-semibold text-white">Mathematics</td><td className="p-3">18/20</td><td className="p-3">88/100</td><td className="p-3 text-emerald-400 font-bold">A</td></tr>
                                <tr><td className="p-3 font-semibold text-white">Physics</td><td className="p-3">16/20</td><td className="p-3">82/100</td><td className="p-3 text-emerald-400 font-bold">A-</td></tr>
                                <tr><td className="p-3 font-semibold text-white">Chemistry</td><td className="p-3">19/20</td><td className="p-3">94/100</td><td className="p-3 text-indigo-400 font-bold">A+</td></tr>
                                <tr><td className="p-3 font-semibold text-white">English</td><td className="p-3">15/20</td><td className="p-3">78/100</td><td className="p-3 text-amber-400 font-bold">B+</td></tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Stacked Cards */}
                          <div className="sm:hidden space-y-3">
                            {[
                              { sub: 'Mathematics', ct: '18/20', mt: '88/100', grade: 'A', gColor: 'text-emerald-400' },
                              { sub: 'Physics', ct: '16/20', mt: '82/100', grade: 'A-', gColor: 'text-emerald-400' },
                              { sub: 'Chemistry', ct: '19/20', mt: '94/100', grade: 'A+', gColor: 'text-indigo-400' },
                              { sub: 'English', ct: '15/20', mt: '78/100', grade: 'B+', gColor: 'text-amber-400' },
                            ].map((row, i) => (
                              <div key={i} className="bg-slate-900 border border-white/5 rounded-xl p-4 text-sm flex gap-4">
                                <div className="flex-1 space-y-1">
                                  <div className="font-bold text-white text-base">{row.sub}</div>
                                  <div className="text-slate-400 text-xs flex justify-between"><span>Class Test:</span> <span className="text-white">{row.ct}</span></div>
                                  <div className="text-slate-400 text-xs flex justify-between"><span>Mid Term:</span> <span className="text-white">{row.mt}</span></div>
                                </div>
                                <div className={`flex items-center justify-center font-display font-black text-2xl ${row.gColor}`}>
                                  {row.grade}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {profileTab === 'remarks' && (
                    <div className="animate-fadeIn space-y-4">
                      <div className="p-5 border-l-4 border-emerald-500 bg-emerald-500/10 rounded-r-xl">
                        <h4 className="text-sm font-bold text-emerald-400">Excellent Contribution</h4>
                        <p className="text-xs text-slate-300 mt-1">Consistently active in class participation and helps peers in the Whiteboard streams.</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-2">- Mr. Anderson, Physics Dept</p>
                      </div>
                      <div className="p-5 border-l-4 border-indigo-500 bg-indigo-500/10 rounded-r-xl">
                        <h4 className="text-sm font-bold text-indigo-400">Project Leadership</h4>
                        <p className="text-xs text-slate-300 mt-1">Displayed great leadership in the recent House Science project.</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-2">- Mrs. Smith, Class Teacher</p>
                      </div>
                    </div>
                  )}

                  {profileTab === 'analytics' && currentUser && (
                    <StudentAiAnalytics currentUser={currentUser} />
                  )}

                  {profileTab === 'enter_marks' && (
                    <StudentMarksCenter currentUser={currentUser} effectiveRole={effectiveRole} showNotification={showNotification} />
                  )}

                  {['house_reports', 'warn_classes'].includes(profileTab) && (
                    <CoordinatorModule currentUser={currentUser} showNotification={showNotification} />
                  )}

                  {['students', 'teachers', 'coordinators', 'reports', 'requests'].includes(profileTab) && (effectiveRole === 'admin' || effectiveRole === 'super_admin') && (
                    <AdminCenter currentUser={currentUser} showNotification={showNotification} profileTab={profileTab} />
                  )}

                  {['teacher_list', 'requests'].includes(profileTab) && effectiveRole === 'coordinator' && (
                    <AdminCenter currentUser={currentUser} showNotification={showNotification} profileTab={profileTab} />
                  )}

                  {['student_list'].includes(profileTab) && ((effectiveRole as any) === 'teacher' || effectiveRole === 'coordinator') && currentUser && (
                    <div className="space-y-6">
                      <div className="p-6 rounded-3xl bg-slate-900 border border-white/5 animate-fadeIn">
                        <h4 className="font-bold text-white text-lg mb-4">My Students</h4>
                        <TeacherStudentList currentUser={currentUser} />
                      </div>
                    </div>
                  )}

                  {['student_reports', 'class_reports', 'section_reports'].includes(profileTab) && ((effectiveRole as any) === 'teacher' || effectiveRole === 'coordinator') && currentUser && (
                    <div className="space-y-6">
                      <div className="p-6 rounded-3xl bg-slate-900 border border-white/5 animate-fadeIn">
                        <h4 className="font-bold text-white text-lg mb-4">{profileTab.replace('_', ' ').toUpperCase()}</h4>
                        {profileTab === 'student_reports' ? (
                          <TeacherStudentReports currentUser={currentUser} />
                        ) : (
                          <div className="p-8 border border-dashed border-indigo-500/30 rounded-3xl text-center bg-indigo-500/5 space-y-3">
                            <span className="text-4xl block">📊</span>
                            <p className="text-slate-400 text-xs text-balance">Aggregate class and section analytics are coming in the next term update.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {currentUser && profileTab === 'overview' && (effectiveRole === 'admin' || effectiveRole === 'super_admin') && (
                    <div className="mt-8 pt-6 border-t border-white/5 space-y-4 animate-fadeIn">
                       <h4 className="text-xl font-bold text-white tracking-widest">School Overview</h4>
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                         <div className="p-6 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-center space-y-2">
                           <span className="text-3xl block">👨‍🎓</span>
                           <p className="text-3xl font-black text-white">850</p>
                           <p className="text-xs text-indigo-400 uppercase font-bold tracking-wider">Total Students</p>
                         </div>
                         <div className="p-6 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center space-y-2">
                           <span className="text-3xl block">👩‍🏫</span>
                           <p className="text-3xl font-black text-white">42</p>
                           <p className="text-xs text-emerald-400 uppercase font-bold tracking-wider">Total Teachers</p>
                         </div>
                         <div className="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-center space-y-2">
                           <span className="text-3xl block">👔</span>
                           <p className="text-3xl font-black text-white">8</p>
                           <p className="text-xs text-amber-400 uppercase font-bold tracking-wider">Coordinators</p>
                         </div>
                       </div>
                    </div>
                  )}

                  {currentUser && profileTab === 'overview' && effectiveRole !== 'admin' && (
                    (() => {
                      const userMaterials = materials.filter(m => m.uploadedBy === currentUser.name || m.uploaderUid === currentUser?.uid);
                      const totalUploads = userMaterials.length;
                      const totalDownloads = userMaterials.reduce((acc, curr) => acc + (curr.downloads || 0), 0);
                      const totalLikes = userMaterials.reduce((acc, curr) => acc + (curr.likes || 0), 0);
                      
                      return (
                        <div className="mt-8 pt-6 border-t border-white/5 space-y-4 animate-fadeIn">
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">📚 Material Hub Contributions summary</h4>
                            <p className="text-[11px] text-slate-400">Contribution index tracking peer utility points for your identity profile.</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 text-center space-y-1">
                              <span className="text-2xl block">📤</span>
                              <p className="text-xl font-extrabold text-white">{totalUploads}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Uploaded</p>
                            </div>
                            <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 text-center space-y-1">
                              <span className="text-2xl block">📥</span>
                              <p className="text-xl font-extrabold text-white">{totalDownloads}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Downloads</p>
                            </div>
                            <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 text-center space-y-1">
                              <span className="text-2xl block">❤️</span>
                              <p className="text-xl font-extrabold text-white">{totalLikes}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Likes Received</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                  </>
                  )}
                </div>
              )}

              {/* Tab: Parental Portal */}
              {activeTab === 'parent_portal' && (
                <ParentalPortal currentUser={currentUser} showNotification={showNotification} />
              )}

              {/* Tab: Blogs View */}
              {activeTab === 'blogs' && (
                <BlogsPortal 
                  currentUser={currentUser} 
                  isSuperAdmin={isSuperAdmin || currentUser?.role === 'super_admin'} 
                  showNotification={showNotification} 
                />
              )}
              {/* Tab: Sports & Activities View */}
              {activeTab === 'sports_activities' && (
                <SportsActivitiesPortal 
                  key={currentUser?.uid || currentUser?.email || 'sports'}
                  currentUser={currentUser} 
                  showNotification={showNotification} 
                />
              )}
              {/* Tab: StudentOS Meet Virtual Classroom */}
              {activeTab === 'meet' && (
                <StudentOSMeet 
                  currentUser={currentUser} 
                  effectiveRole={effectiveRole} 
                  onNavigateTab={setActiveTab} 
                />
              )}
              {/* Tab: Substitute Board View */}
              {activeTab === 'substitutes' && (
                <SubstituteHub 
                  currentUser={currentUser} 
                  effectiveRole={effectiveRole}
                  showNotification={showNotification} 
                />
              )}
              {/* Tab 3: Whiteboard / Smart Board Classroom - Full Screen Immersive */}
              {activeTab === 'whiteboard' && (
                <Whiteboard2 onClose={() => setActiveTab('dashboard')} currentUser={currentUser} />
              )}
              {/* Tab: Assignment Center */}
              {activeTab === 'assignments' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-6 max-w-6xl mx-auto"
                >
                  <div className="bento-card rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
                        <span>Academic Coursework</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-400">
                          {effectiveRole === 'student' ? `${currentUser.grade || 'Grade 10'} (${currentUser.section || 'Solara'})` : 'Faculty & Class Management'}
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
                        Assignment Center
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-400">
                        Access daily homework, subject projects, practice worksheets, class timetables, and official notices.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTabSelect('homework')}
                        className="uiverse-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>Open Homework Desk ({homeworkList.length})</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[
                      {
                        tab: 'homework',
                        icon: '📓',
                        title: 'Daily Homework',
                        meta: `${homeworkList.length} posted`,
                        desc: 'Track daily class assignments, due dates, and submission status.'
                      },
                      {
                        tab: 'assignment_viewer',
                        icon: '📋',
                        title: 'Subject Projects & Assignments',
                        meta: 'Long-term work',
                        desc: 'Download project briefs, rubrics, and term coursework files.'
                      },
                      {
                        tab: 'worksheet_viewer',
                        icon: '📝',
                        title: 'Practice Worksheets',
                        meta: 'Revision sets',
                        desc: 'Chapter-wise problem sets and exam preparation sheets.'
                      },
                      {
                        tab: 'timetable_viewer',
                        icon: '📅',
                        title: 'Class Timetables',
                        meta: 'Schedules',
                        desc: 'Weekly lecture schedules, lab slots, and assessment dates.'
                      },
                      {
                        tab: 'notice_viewer',
                        icon: '📢',
                        title: 'Class Notices',
                        meta: 'Bulletins',
                        desc: 'Important circulars and updates from teachers and coordinators.'
                      },
                      {
                        tab: 'gallery_viewer',
                        icon: '🖼️',
                        title: 'Campus Event Gallery',
                        meta: 'Media',
                        desc: 'Highlights from science fairs, house competitions, and workshops.'
                      }
                    ].map((card) => (
                      <div
                        key={card.tab}
                        onClick={() => handleTabSelect(card.tab)}
                        className="bento-card p-6 rounded-3xl flex flex-col justify-between gap-4 cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-3xl">{card.icon}</span>
                          <span className="text-xs font-mono text-slate-400 group-hover:text-indigo-300 transition-colors">
                            {card.meta} →
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                            {card.title}
                          </h3>
                          <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '') && (
                    <div className="pt-2">
                      <AssignmentCenter />
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'gallery_viewer' && (
                <SimpleResourceManager 
                  type="gallery" title="Event Photo Gallery" emoji="🖼️" 
                  currentUser={currentUser} effectiveRole={effectiveRole} showNotification={showNotification} 
                  goBack={() => handleTabSelect('assignments')} 
                />
              )}

              {activeTab === 'timetable_viewer' && (
                <div className="space-y-6">
                  <OfficialTimetableViewer 
                    currentUser={currentUser} 
                    effectiveRole={effectiveRole} 
                    showNotification={showNotification} 
                    goBack={() => handleTabSelect('assignments')} 
                  />
                </div>
              )}

              {activeTab === 'worksheet_viewer' && (
                <SimpleResourceManager 
                  type="worksheet" title="Worksheets" emoji="📝" 
                  currentUser={currentUser} effectiveRole={effectiveRole} showNotification={showNotification} 
                  goBack={() => handleTabSelect('assignments')} 
                />
              )}

              {activeTab === 'assignment_viewer' && (
                <SimpleResourceManager 
                  type="assignment" title="Assignments" emoji="📋" 
                  currentUser={currentUser} effectiveRole={effectiveRole} showNotification={showNotification} 
                  goBack={() => handleTabSelect('assignments')} 
                />
              )}

              {activeTab === 'notice_viewer' && (
                <SimpleResourceManager 
                  type="notice" title="Class Notices" emoji="📢" 
                  currentUser={currentUser} effectiveRole={effectiveRole} showNotification={showNotification} 
                  goBack={() => handleTabSelect('assignments')} 
                />
              )}

              {/* Tab: Class Homework System */}
              {activeTab === 'homework' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Banner Header card */}
                  <div className="smart-glass p-6 sm:p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">Online Homework Desk</span>
                        {currentUser?.grade && (
                          <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">Your Class: {currentUser.grade}</span>
                        )}
                      </div>
                      <h3 className="text-2xl font-black font-display text-white">Academic Tasks & Assignments</h3>
                      <p className="text-xs text-slate-400 max-w-2xl">Access, study, and track homework assigned online by certified teachers. Feel stuck? Click "💡 AI Teacher Assistant" to debug complex calculations or theoretical concepts instantly.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      {effectiveRole === 'student' ? (
                        <button 
                          onClick={() => {
                            setHwFilterGrade(currentUser?.grade || 'Grade 12');
                            setHwSearch('');
                            showNotification('Aligned filters to your active class level!');
                          }}
                          className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 font-bold px-4 py-2 text-xs rounded-xl transition-all"
                        >
                          🎯 Align to My Grade
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              setHwEditId(null);
                              setHwFSubject('');
                              setHwFTitle('');
                              setHwFContent('');
                              setHwFGrade(currentUser?.assignedGrades?.[0] || 'Grade 12');
                              setHwFSection('All Sections');
                              setHwFormOpen(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                          >
                            <Plus size={14} /> Create Homework
                          </button>
                          <button 
                            onClick={() => {
                              setHwFilterGrade('My Classes');
                              setHwSearch('');
                              showNotification('Filtered homework for your assigned classes only.');
                            }}
                            className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 font-bold px-4 py-2 text-xs rounded-xl transition-all"
                          >
                            📚 My Assigned Classes
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {hwFormOpen && (effectiveRole === 'teacher' || effectiveRole === 'coordinator' || effectiveRole === 'admin' || effectiveRole === 'super_admin') && (
                    <div className="smart-glass p-6 rounded-3xl border border-indigo-500/30 space-y-4 animate-slideUp">
                      <div className="flex justify-between items-center">
                        <h4 className="text-lg font-bold text-white">{hwEditId ? 'Edit Homework' : 'Create New Homework'}</h4>
                        <button onClick={() => setHwFormOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Subject</label>
                          <input type="text" value={hwFSubject} onChange={e=>setHwFSubject(e.target.value)} required placeholder="e.g. Mathematics" className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Title</label>
                          <input type="text" value={hwFTitle} onChange={e=>setHwFTitle(e.target.value)} required placeholder="e.g. Chapter 4 Exercises" className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" />
                        </div>
                        <div className="col-span-full">
                          <label className="text-xs text-slate-400 font-bold block mb-1">Instructions</label>
                          <textarea value={hwFContent} onChange={e=>setHwFContent(e.target.value)} rows={4} required placeholder="Explain the assignment..." className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Target Grade</label>
                          <select value={hwFGrade} onChange={e=>setHwFGrade(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm">
                            {Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`).map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Target Section</label>
                          <select value={hwFSection} onChange={e=>setHwFSection(e.target.value as any)} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm">
                            <option value="All Sections">All Sections</option>
                            <option value="Astra">Astra</option>
                            <option value="Elara">Elara</option>
                            <option value="Solara">Solara</option>
                            <option value="Vega">Vega</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/10">
                        <button type="button" onClick={() => setHwFormOpen(false)} className="px-4 py-2 hover:bg-white/5 text-slate-300 rounded-xl text-xs font-bold transition-all">Cancel</button>
                        <button type="button" onClick={() => {
                          if (!hwFSubject || !hwFTitle || !hwFContent) {
                            showNotification('Please fill in all required fields.');
                            return;
                          }
                          const newHw: Homework = {
                            id: hwEditId || `hw-${Date.now()}`,
                            subject: hwFSubject,
                            title: hwFTitle,
                            content: hwFContent,
                            classGrade: hwFGrade,
                            classSection: hwFSection,
                            dueDate: new Date(Date.now() + 86400000).toISOString().split(',')[0], // Default tomorrow
                            createdAt: hwEditId ? homeworkList.find(h=>h.id === hwEditId)?.createdAt || new Date().toISOString().split(',')[0] : new Date().toISOString().split(',')[0],
                            completedList: hwEditId ? homeworkList.find(h=>h.id === hwEditId)?.completedList || [] : [],
                            givenBy: currentUser?.name || 'Teacher'
                          };
                          
                          setHomeworkList(prev => {
                            if (hwEditId) return prev.map(h => h.id === hwEditId ? newHw : h);
                            return [newHw, ...prev];
                          });
                          saveSupabaseHomework(newHw);

                          if (!hwEditId) {
                            sendNotificationToUsers({
                              title: '📝 Homework Added',
                              message: `"${hwFTitle}" in ${hwFSubject} assigned by ${currentUser?.name || 'Teacher'}.`,
                              type: 'homework',
                              targetGrades: [hwFGrade],
                              targetSections: hwFSection === 'All Sections' ? undefined : [hwFSection]
                            }).catch(e => console.error(e));
                          }

                          showNotification(hwEditId ? 'Homework updated!' : 'Homework created and published!');
                          setHwFormOpen(false);
                        }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                          <Check size={14}/> {hwEditId ? 'Update Homework' : 'Publish Homework'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Filter & Status Control Bar */}
                  <div className="bento-card p-4 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search assignments by subject or title..."
                          value={hwSearch}
                          onChange={e => setHwSearch(e.target.value)}
                          className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <select
                        value={hwFilterGrade}
                        onChange={e => setHwFilterGrade(e.target.value)}
                        className="text-xs px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="All Grades">All Grades (Grade 1 - 12)</option>
                        {effectiveRole !== 'student' && <option value="My Classes">My Assigned Classes</option>}
                        {Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`).map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-white/10">
                        {(['all', 'pending', 'completed'] as const).map((statusKey) => (
                          <button
                            key={statusKey}
                            type="button"
                            onClick={() => setHwStatusFilter(statusKey)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                              hwStatusFilter === statusKey
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {statusKey}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Homework Grid list */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {(() => {
                      const userEmail = currentUser?.email || 'anonymous@school.edu';
                      const filtered = homeworkList.filter(hw => {
                        let roleAllowed = true;
                        if (effectiveRole === 'student') {
                          const normG = (g?: string) => g ? g.toLowerCase().replace(/grade|class/g, '').trim() : '';
                          const normS = (s?: string) => s ? s.toLowerCase().trim() : '';
                          const sg = normG(currentUser?.grade);
                          const hg = normG(hw.classGrade);
                          const ss = normS(currentUser?.section);
                          const hs = normS(hw.classSection);
                          const gradeMatches = !sg || !hg || sg === hg || hw.classGrade === 'All Grades';
                          const secMatches = hw.classSection === 'All Sections' || !ss || !hs || ss === hs;
                          roleAllowed = gradeMatches && secMatches;
                        } else if (effectiveRole === 'teacher') {
                          const gradeMatch = !currentUser?.assignedGrades || currentUser.assignedGrades.length === 0 || currentUser.assignedGrades.includes(hw.classGrade);
                          const secMatch = hw.classSection === 'All Sections' || !currentUser?.assignedSections || currentUser.assignedSections.length === 0 || currentUser.assignedSections.includes(hw.classSection);
                          const isMyCreation = hw.givenBy === currentUser?.name || hw.givenBy === 'Teacher';
                          if (hwFilterGrade === 'My Classes') {
                            roleAllowed = (gradeMatch && secMatch) || isMyCreation;
                          } else {
                            roleAllowed = true;
                          }
                        } else {
                          roleAllowed = true;
                        }
                        
                        const matchG = hwFilterGrade === 'All Grades' || 
                                     (hwFilterGrade === 'My Classes' ? roleAllowed : hw.classGrade === hwFilterGrade);
                        const matchS = !hwSearch.trim() || hw.title.toLowerCase().includes(hwSearch.toLowerCase()) || hw.content.toLowerCase().includes(hwSearch.toLowerCase()) || hw.subject.toLowerCase().includes(hwSearch.toLowerCase());
                        const isDone = hw.completedList?.includes(userEmail);
                        const matchStatus =
                          hwStatusFilter === 'all' ? true : hwStatusFilter === 'completed' ? Boolean(isDone) : !isDone;
                        
                        return roleAllowed && matchG && matchS && matchStatus;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="col-span-1 lg:col-span-2 smart-glass p-6 sm:p-12 text-center space-y-3 rounded-3xl border border-dashed border-white/5">
                            <span className="text-4xl block">✨</span>
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Academic Clear Space</h4>
                            <p className="text-xs text-slate-400 max-w-md mx-auto">No online assignments matched the current grade level or filter credentials. Check out alternative grades or enjoy your free hours!</p>
                          </div>
                        );
                      }

                      return filtered.map(hw => {
                        const userEmail = currentUser?.email || 'anonymous@school.edu';
                        const isDone = hw.completedList?.includes(userEmail);

                        const toggleCompleted = () => {
                          if (effectiveRole === 'student' && hw.classGrade !== currentUser?.grade) {
                            showNotification(`⚠️ Mismatch: This homework is assigned to ${hw.classGrade}. Your profile level is ${currentUser.grade}!`);
                            return;
                          }
                          let updatedHw: Homework | null = null;
                          setHomeworkList(prev => prev.map(item => {
                            if (item.id === hw.id) {
                              const list = item.completedList || [];
                              const updatedList = list.includes(userEmail)
                                ? list.filter(m => m !== userEmail)
                                : [...list, userEmail];
                              updatedHw = { ...item, completedList: updatedList };
                              return updatedHw;
                            }
                            return item;
                          }));
                          if (updatedHw) saveSupabaseHomework(updatedHw);
                          if (!isDone) {
                            awardStudentXP(currentUser, 'complete_homework', { uniqueItemId: hw.id });
                          }
                          showNotification(isDone ? 'Marked assignment incomplete.' : 'Excellent work! Assignment marked complete.');
                        };

                        const handleAskAIHelper = () => {
                          setAiInput(`Greetings! I'm currently working on my ${hw.subject} online homework assigned to ${hw.classGrade} [Section: ${hw.classSection || 'All' }].

**Assignment Title**: ${hw.title}
**Instructions**:
${hw.content}

Could you please guide me step-by-step on how to solve this, explaining the theoretical framework?`);
                          setSelectedPersona('study_buddy');
                          setActiveTab('ai_teacher');
                          showNotification('Transmitted assignment parameters directly to Campus AI Mentor!');
                        };

                        return (
                          <div 
                            key={hw.id} 
                            className={`smart-glass p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow ${isDone ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-white/5 hover:border-indigo-500/20'}`}
                          >
                            <div className="space-y-3 flex-1">
                              
                              {/* Metadata indicators */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[8px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                                    📘 {hw.subject}
                                  </span>
                                  <span className="text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                    🏫 {hw.classGrade}
                                  </span>
                                  <span className="text-[8px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                                    🛡️ {hw.classSection || 'All Sections'}
                                  </span>
                                </div>
                                <span className="text-[9px] font-mono text-slate-400">📅 Due: {hw.dueDate}</span>
                              </div>

                              {/* Title */}
                              <div className="space-y-1">
                                <h4 className="text-sm font-extrabold text-white font-display tracking-tight leading-snug">{hw.title}</h4>
                                <p className="text-[10px] text-slate-500 leading-none">Dispatched on: {hw.createdAt} • Assigned by: {hw.givenBy}</p>
                              </div>

                              {/* Content description rendered as Markdown */}
                              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300 leading-relaxed font-sans space-y-2 select-text">
                                {renderMarkdown(hw.content)}
                              </div>

                              {(effectiveRole === 'teacher' || effectiveRole === 'coordinator' || effectiveRole === 'admin' || effectiveRole === 'super_admin') && hw.completedList && hw.completedList.length > 0 && (
                                <div className="mt-2 text-[10px] bg-slate-900 border border-white/5 p-2 rounded-lg text-slate-400">
                                  <strong>✅ Submissions ({hw.completedList.length}):</strong>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {hw.completedList.map(em => (
                                      <span key={em} className="bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded">{em}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                            </div>

                            {/* Options panel */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/5 text-xs">
                              
                              {/* Progress checkbox */}
                              <button
                                onClick={toggleCompleted}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wide transition-all ${isDone ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400' : 'bg-slate-900 hover:bg-slate-850 border border-white/10 text-slate-300'}`}
                              >
                                {isDone ? '✅ Finished!' : '⬜ Mark Completed'}
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleAskAIHelper}
                                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase transition-all"
                                  title="Explain this lesson step-by-step"
                                >
                                  💡 AI Teacher Assistant
                                </button>

                                 {(effectiveRole === 'teacher' || effectiveRole === 'coordinator' || effectiveRole === 'admin' || effectiveRole === 'super_admin') && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setHwEditId(hw.id);
                                        setHwFSubject(hw.subject);
                                        setHwFTitle(hw.title);
                                        setHwFContent(hw.content);
                                        setHwFGrade(hw.classGrade);
                                        setHwFSection(hw.classSection);
                                        setHwFormOpen(true);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }}
                                      className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-400 transition-all text-xs"
                                      title="Edit assigned homework"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm(`Remove custom assigned homework "${hw.title}" for ${hw.classGrade}?`)) {
                                          setHomeworkList(prev => prev.filter(item => item.id !== hw.id));
                                          deleteSupabaseHomework(hw.id);
                                          showNotification('Class homework removed from databases.');
                                        }
                                      }}
                                      className="p-1.5 rounded bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 transition-all text-xs"
                                      title="Revoke assigned homework"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )}
                              </div>

                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                </div>
              )}

              {activeTab === 'houses' && (
                <HouseChampionship currentUser={currentUser} effectiveRole={effectiveRole} showNotification={showNotification} />
              )}

              {/* 
                 LOCKED - READ-ONLY - DO NOT MODIFY
                 Material Hub serves as the reference implementation.
                 All future changes to Materials MUST happen via extension, never modification.
              */}
              {activeTab === 'materials' && (
                <div className="space-y-8 animate-fadeIn">
                  {dataLoading && !showStartup ? (
                    <div className="space-y-8">
                      <Skeleton className="h-40 w-full rounded-3xl" />
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-32 rounded-xl flex-shrink-0" />
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </div>
                    </div>
                  ) : (
                    <>
                  
                  {/* Subject and Statistics Banner */}
                  <div className="smart-glass p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 tracking-wider">Academic Material Hub</span>
                        <h3 className="text-xl sm:text-2xl font-black font-display text-white">Central Knowledge Vault</h3>
                        <p className="text-xs text-slate-400 max-w-xl">Google Drive + Classroom Notes. Share syllabus outlines, assignment briefs, and questions to accumulate House standings!</p>
                      </div>
                      <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
                          <button 
                            onClick={async () => {
                              showNotification("Starting URL Repair & Deduplication...");
                              try {
                                let repairCount = 0;
                                let dedupCount = 0;
                                const updatedMaterials = [...materials];
                                
                                for (let i = 0; i < updatedMaterials.length; i++) {
                                  const mat = updatedMaterials[i];
                                  if (mat.url && (!mat.url.startsWith('http') || mat.url.includes('example.com'))) {
                                    const path = mat.storagePath || `materials/${mat.id}_${mat.fileName}`;
                                    try {
                                      const { data } = supabase.storage.from('StudentOS').getPublicUrl(path);
                                      const newUrl = data.publicUrl;
                                      const nextMat = { ...mat, url: newUrl, storagePath: path };
                                      await saveSupabaseMaterial(nextMat);
                                      updatedMaterials[i] = nextMat;
                                      repairCount++;
                                    } catch (err) {
                                      console.error("Failed to repair:", mat.title, err);
                                    }
                                  }
                                }
                                
                                // Phase 2: Deduplication (Keep one copy of 'The Fun they had')
                                const deletedIds = new Set<string>();
                                const theFunMaterials = updatedMaterials.filter(m => m.title && m.title.toLowerCase().includes('the fun they had'));
                                if (theFunMaterials.length > 1) {
                                  const sorted = theFunMaterials.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                                  for (let i = 1; i < sorted.length; i++) {
                                    try {
                                      await deleteSupabaseMaterial(sorted[i].id);
                                      deletedIds.add(sorted[i].id);
                                      dedupCount++;
                                    } catch (err) {
                                      console.error("Failed to delete duplicate:", sorted[i].title, err);
                                    }
                                  }
                                }
                                
                                // Also deduplicate by name strictly overall just in case
                                const titleMap = new Set<string>();
                                for (const mat of updatedMaterials) {
                                  if (deletedIds.has(mat.id)) continue;
                                  if (mat.title && mat.title.toLowerCase() === 'the fun they had') continue; // handled above
                                  const key = mat.title.toLowerCase().trim();
                                  if (titleMap.has(key)) {
                                    try {
                                      await deleteSupabaseMaterial(mat.id);
                                      deletedIds.add(mat.id);
                                      dedupCount++;
                                    } catch(e) { }
                                  } else {
                                    titleMap.add(key);
                                  }
                                }

                                const finalFiltered = updatedMaterials.filter(m => !deletedIds.has(m.id));
                                setMaterials(finalFiltered);
                                showNotification(`Complete! Fixed ${repairCount} URLs, Deleted ${dedupCount} Duplicates.`);
                              } catch (e) {
                                console.error(e);
                                showNotification("Repair failed.");
                              }
                            }}
                            className="text-xs font-bold bg-amber-600/20 hover:bg-amber-600/40 text-amber-500 border border-amber-500/30 px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto"
                          >
                            🔧 Repair & Deduplicate
                          </button>

                        <button 
                          onClick={() => setOpenUploadModal(true)}
                          className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto"
                        >
                          <Plus className="w-4 h-4" /> Share Resource
                        </button>
                      </div>
                    </div>

                    {/* Integrated Sub-Tabs Dropdown Navigation */}
                    <div className="pt-2 pb-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="w-full sm:max-w-md">
                          <ProfessionalTabDropdown
                            options={[
                              { id: 'feed', label: 'Shared Resources', icon: '📂', description: 'Browse community and faculty uploads' },
                              { id: 'my_uploads', label: 'My Uploads', icon: '☁️', description: 'Files you have contributed to the hub' },
                              { id: 'verified', label: 'Verified Resources', icon: '✅', description: 'Teacher-approved curriculum files' },
                              ...(['teacher', 'admin', 'coordinator', 'super_admin'].includes(effectiveRole)
                                ? [{ id: 'teacher_vault', label: 'Teacher Vault', icon: '🔒', description: 'Restricted faculty repository' }]
                                : []),
                              { id: 'saved', label: 'Saved Bookmarks', icon: '🔖', badge: savedMaterialIds.length > 0 ? savedMaterialIds.length : undefined, description: 'Bookmarked for quick access' }
                            ]}
                            selectedId={activeMaterialSubTab}
                            onSelect={(id) => setActiveMaterialSubTab(id)}
                            size="md"
                          />
                        </div>
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-300">
                          <span className="text-slate-500 font-medium">Viewing Category:</span>
                          <span className="font-bold text-indigo-400 capitalize">
                            {activeMaterialSubTab.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Grid Content Area */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Filter and List Panel */}
                    <div className="lg:col-span-8 space-y-6">
                      
                      {/* Search, Action Buttons & Breadcrumb Segment */}
                      <div className="smart-glass p-3.5 sm:p-4 rounded-3xl space-y-3 border border-white/5 shadow-sm">
                        
                        {/* Top Action Row: Search + New Folder + Upload */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="relative flex-1">
                            <input 
                              type="text" 
                              value={materialsSearchQuery}
                              onChange={e => setMaterialsSearchQuery(e.target.value)}
                              placeholder="Search materials, exam years, topics..." 
                              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-white"
                            />
                            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => {
                                setNewMaterialFolderName('');
                                setShowMaterialFolderModal(true);
                              }}
                              className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer flex-1 sm:flex-initial"
                              title="Create Material Hub Folder"
                            >
                              <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
                              <span>+ New Folder</span>
                            </button>

                            <button 
                              onClick={() => setOpenUploadModal(true)}
                              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Share File</span>
                            </button>
                          </div>
                        </div>

                        {/* Breadcrumbs Navigation Bar */}
                        {(() => {
                          const activeFolder = materialFolders.find(f => f.id === activeMaterialFolderId);
                          return (
                            <div className="flex items-center justify-between gap-2 p-2 bg-slate-950/70 border border-white/5 rounded-2xl text-[11px]">
                              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none no-scrollbar min-w-0">
                                <button
                                  onClick={() => setActiveMaterialFolderId(null)}
                                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                                    !activeMaterialFolderId ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <span>🏠 Root</span>
                                </button>
                                {activeFolder && (
                                  <>
                                    <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 truncate max-w-[150px]">
                                      <span>📁 {activeFolder.name}</span>
                                    </div>
                                  </>
                                )}
                              </div>

                              {activeMaterialFolderId && (
                                <button
                                  onClick={() => setActiveMaterialFolderId(null)}
                                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                                  title="Return to Root level"
                                >
                                  ↑ Back to Root
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        {/* Compact 4-Column Dropdown Filters */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[10px]">
                          <div>
                            <select 
                              value={materialsGradeFilter}
                              onChange={e => setMaterialsGradeFilter(e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="All">All Grades</option>
                              <option value="Grade 9">Grade 9</option>
                              <option value="Grade 10">Grade 10</option>
                              <option value="Grade 11">Grade 11</option>
                              <option value="Grade 12">Grade 12</option>
                            </select>
                          </div>

                          <div>
                            <select 
                              value={materialsSubjectFilter}
                              onChange={e => setMaterialsSubjectFilter(e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              {['All', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English', 'Social Science', 'General'].map(sub => (
                                <option key={sub} value={sub}>{sub === 'All' ? 'All Subjects' : sub}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <select 
                              value={materialsTypeFilter}
                              onChange={e => setMaterialsTypeFilter(e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="All">All Formats</option>
                              <option value="pdf">PDF File</option>
                              <option value="ppt">PPT Slide Deck</option>
                              <option value="doc">Word Document</option>
                              <option value="image">Diagram / Image</option>
                              <option value="notes">Lecture Notes</option>
                              <option value="assignment">Assignment Sheet</option>
                              <option value="question-paper">Question Paper</option>
                              <option value="project">Project Work</option>
                            </select>
                          </div>

                          <div>
                            <select 
                              value={materialsSortBy}
                              onChange={e => setMaterialsSortBy(e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="Newest">Newest first</option>
                              <option value="Downloads">Most Downloaded</option>
                              <option value="Likes">Most Liked</option>
                              <option value="Verified">Verified First</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Windows / Android File Manager: Folders First */}
                      {!activeMaterialFolderId && materialFolders.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                              <span>📁 Folders ({materialFolders.length})</span>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {materialFolders.map(f => {
                              const fileCount = materials.filter(m => m.folder_id === f.id).length;
                              return (
                                <motion.div
                                  key={f.id}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => setActiveMaterialFolderId(f.id)}
                                  className="p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-white/5 hover:border-amber-500/40 transition-all cursor-pointer group flex flex-col justify-between space-y-2 shadow-sm"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xl">📁</span>
                                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                      <button
                                        onClick={() => {
                                          setRenameMaterialFolderModal({ id: f.id, name: f.name });
                                          setRenameMaterialInput(f.name);
                                        }}
                                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                                        title="Rename Folder"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteMaterialFolder(f.id, f.name)}
                                        className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400"
                                        title="Delete Folder"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-white group-hover:text-amber-300 truncate">{f.name}</p>
                                    <p className="text-[9px] text-slate-400 font-mono">{fileCount} {fileCount === 1 ? 'file' : 'files'}</p>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Materials List Generator */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            {activeMaterialFolderId 
                              ? `Files in "${materialFolders.find(f => f.id === activeMaterialFolderId)?.name || 'Folder'}"` 
                              : 'Files at Root'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {(() => {
                          let displayList = materials;
                          const totalRaw = displayList.length;

                          // File Manager folder filtering: show only files in active folder, or files at root
                          if (activeMaterialFolderId) {
                            displayList = displayList.filter(m => m.folder_id === activeMaterialFolderId);
                          } else {
                            displayList = displayList.filter(m => !m.folder_id);
                          }

                          // Feed, notes, question papers, bookmarks state filter
                          if (activeMaterialSubTab === 'papers') {
                            displayList = displayList.filter(m => m.type === 'question-paper');
                          } else if (activeMaterialSubTab === 'library') {
                            displayList = displayList.filter(m => m.type === 'notes' || m.type === 'ppt');
                          } else if (activeMaterialSubTab === 'saved') {
                            displayList = displayList.filter(m => savedMaterialIds.includes(m.id));
                          } else if (activeMaterialSubTab === 'my_uploads') {
                            displayList = displayList.filter(m => m.uploaderUid === currentUser?.uid);
                          } else if (activeMaterialSubTab === 'verified') {
                            displayList = displayList.filter(m => m.isVerified);
                          } else if (activeMaterialSubTab === 'teacher_vault') {
                            displayList = displayList.filter(m => m.visibility === 'teacher');
                          }
                          const subTabFiltered = displayList.length;

                          // Role-based visibility isolation (Students never see teacher tier material)
                          if (effectiveRole === 'student') {
                            displayList = displayList.filter(m => m.visibility !== 'teacher');
                          }
                          const roleFiltered = displayList.length;

                          // Private resources are only visible to their uploader
                          displayList = displayList.filter(m => m.visibility !== 'private' || m.uploaderUid === currentUser?.uid);
                          const privateFiltered = displayList.length;

                          // Subject specialized filter
                          if (materialsSubjectFilter !== 'All') {
                            displayList = displayList.filter(m => m.subject === materialsSubjectFilter);
                          }
                          const subjectFiltered = displayList.length;

                          // Target Level granular filter
                          if (materialsGradeFilter !== 'All') {
                            displayList = displayList.filter(m => m.visibleToGrades?.includes(materialsGradeFilter) || m.isPublic !== false);
                          }
                          const gradeFiltered = displayList.length;

                          // Type format filter
                          if (materialsTypeFilter !== 'All') {
                            displayList = displayList.filter(m => m.type === materialsTypeFilter);
                          }
                          const typeFiltered = displayList.length;

                          // General Search match
                          if (materialsSearchQuery.trim()) {
                            const searchQuery = materialsSearchQuery.toLowerCase();
                            displayList = displayList.filter(m => 
                              m.title.toLowerCase().includes(searchQuery) || 
                              m.description.toLowerCase().includes(searchQuery) ||
                              m.subject.toLowerCase().includes(searchQuery) ||
                              m.questionPaperYear?.includes(searchQuery)
                            );
                          }

                          // Sorting
                          if (materialsSortBy === 'Newest') {
                            displayList.sort((a, b) => {
                              const tA = a.created_at || a.createdAt;
                              const tB = b.created_at || b.createdAt;
                              if (typeof tA === 'number' && typeof tB === 'number') return tB - tA;
                              return String(tB).localeCompare(String(tA));
                            });
                          } else if (materialsSortBy === 'Downloads') {
                            displayList.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
                          } else if (materialsSortBy === 'Likes') {
                            displayList.sort((a, b) => (b.likes || 0) - (a.likes || 0));
                          } else if (materialsSortBy === 'Verified') {
                            displayList.sort((a, b) => (b.isVerified ? 1 : 0) - (a.isVerified ? 1 : 0));
                          }

                          if (displayList.length === 0) {
                            return (
                              <div className="smart-glass p-12 rounded-3xl text-center space-y-3 border border-white/5">
                                <span className="text-3xl block">📭</span>
                                <h4 className="text-xs font-bold text-white uppercase tracking-wider">No materials found</h4>
                                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">No records match your filters. Upload custom sheets or adjust subject filters to proceed!</p>
                              </div>
                            );
                          }

                          return displayList.map(mat => {
                            const isLiked = mat.likedBy?.includes(currentUser?.uid || '');
                            const isSaved = savedMaterialIds.includes(mat.id);
                            
                            // Style matching subject
                            let subStyle = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                            if (mat.subject === 'Mathematics') subStyle = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                            else if (mat.subject === 'Physics') subStyle = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                            else if (mat.subject === 'Chemistry') subStyle = 'bg-pink-500/10 text-pink-400 border-pink-500/20';
                            else if (mat.subject === 'Biology') subStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                            else if (mat.subject === 'Computer Science') subStyle = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
                            else if (mat.subject === 'English') subStyle = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                            else if (mat.subject === 'Social Science') subStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                            // House badge styles
                            let houseBadge = '';
                            if (mat.uploaderHouse === 'Ruby') houseBadge = '🟥 Ruby House';
                            else if (mat.uploaderHouse === 'Emerald') houseBadge = '🟩 Emerald House';
                            else if (mat.uploaderHouse === 'Sapphire') houseBadge = '🟦 Sapphire House';
                            else if (mat.uploaderHouse === 'Topaz') houseBadge = '🟨 Topaz House';

                            return (
                              <div key={mat.id} className="smart-glass p-4 sm:p-5 rounded-3xl border border-white/5 space-y-4 hover:border-white/10 transition-all w-full max-w-full overflow-hidden flex flex-col justify-between">
                                <div className="space-y-4 w-full min-w-0">
                                  {/* Top Badge Line */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] font-black uppercase text-slate-400">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className={`px-2 py-0.5 rounded border ${subStyle}`}>{mat.subject}</span>
                                      <span className="bg-white/5 px-2 py-0.5 rounded">{mat.type}</span>
                                      {mat.questionPaperYear && (
                                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">📅 {mat.questionPaperYear}</span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-500">Shared {mat.createdAt}</span>
                                  </div>

                                  {/* Title Header */}
                                  <div className="space-y-1 w-full min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 max-w-full">
                                      <h4 className="text-sm font-black text-white font-display leading-tight truncate w-full">{mat.title}</h4>
                                      {mat.isVerified && (
                                        <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase font-sans mt-0.5 inline-block">verified faculty gold</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed max-w-full break-words">{mat.description}</p>
                                  </div>

                                  {/* Rich File Attachment Card */}
                                {mat.url && (
                                  <div className="bg-slate-900/40 rounded-2xl border border-white/5 overflow-hidden shadow-sm hover:border-indigo-500/10 transition-all">
                                    {/* Item Body based on file classifications */}
                                    {/* 1. IMAGE FILE PREVIEW */}
                                    {((mat.fileType && mat.fileType.startsWith('image/')) || (mat.url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|svg)$/) !== null) || mat.type === 'image') ? (
                                      <div className="relative group/img max-h-[220px] overflow-hidden bg-black/20 flex items-center justify-center border-b border-white/5">
                                        <img 
                                          src={mat.url} 
                                          alt={mat.fileName || 'Attachment Visual'} 
                                          className="max-h-[220px] w-auto object-contain transition-transform group-hover/img:scale-[1.01] duration-300"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider font-extrabold text-white">
                                          🖼️ Digital Image
                                        </div>
                                      </div>
                                    ) : (
                                      /* 2. NON-IMAGE FILE INTERFACES (PDF, AUDIO, VIDEO, OFFICE ASSET) */
                                      <div className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/10 w-full min-w-0">
                                        <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                                          <div className="bg-slate-900 border border-white/5 w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm">
                                            {mat.fileName?.toLowerCase().endsWith('.pdf') || mat.type === 'pdf' ? '📕' :
                                             (mat.fileName?.toLowerCase().endsWith('.doc') || mat.fileName?.toLowerCase().endsWith('.docx') || mat.type === 'doc') ? '📘' :
                                             (mat.fileName?.toLowerCase().endsWith('.ppt') || mat.fileName?.toLowerCase().endsWith('.pptx') || mat.type === 'ppt') ? '📊' :
                                             (mat.fileType && mat.fileType.startsWith('audio/')) ? '🎵' :
                                             (mat.fileType && mat.fileType.startsWith('video/')) ? '🎥' : '📎'}
                                          </div>
                                          <div className="text-left leading-tight space-y-0.5 min-w-0 flex-1">
                                            <p className="font-extrabold text-white text-xs truncate w-full">{mat.fileName || mat.title || 'Attachment Module'}</p>
                                            <p className="text-[10px] text-slate-500 font-mono font-semibold truncate w-full">
                                              {mat.fileSize ? `${(mat.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'Size Unknown'}
                                              <span className="mx-1 text-slate-750 font-sans">•</span>
                                              <span className="uppercase text-[9px] font-bold text-slate-505">{mat.fileType?.split(',')?.[1] || mat.type || 'Binary asset'}</span>
                                            </p>
                                          </div>
                                        </div>

                                        {/* Inline Audio Player fallback */}
                                        {mat.fileType && mat.fileType.startsWith('audio/') && (
                                          <div className="w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
                                            <audio src={mat.url} controls className="w-full sm:w-[220px] h-7 scale-[0.9] origin-right" />
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Inline Video player preview fallback */}
                                    {mat.fileType && mat.fileType.startsWith('video/') && (
                                      <div className="w-full p-3 sm:p-4 bg-slate-950/20 border-t border-white/5">
                                        <video src={mat.url} controls className="w-full max-h-[220px] rounded-xl bg-black/40 border border-white/5" />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Uploader Line */}
                                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 border-t border-b border-white/5 py-2 gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span>Uploaded by: <b className="text-white font-black">{mat.uploadedBy}</b></span>
                                    {houseBadge && (
                                      <span className="text-[10px] font-extrabold">{houseBadge}</span>
                                    )}
                                    {mat.uploaderSection && (
                                      <span className="text-[10px] text-indigo-400 uppercase font-black">🧬 {mat.uploaderSection}</span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-slate-500">
                                    <span>👁️ {mat.views || 0} views</span>
                                    <span>📥 {mat.downloads || 0} downloads</span>
                                    <span>❤️ {mat.likes || 0} likes</span>
                                  </div>
                                </div>
                                </div>

                                {/* Interactive Actions Line */}
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 w-full">
                                    <button 
                                      onClick={() => handleOpenMaterialDocument(mat)}
                                      className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/20 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 w-full whitespace-nowrap overflow-hidden text-ellipsis shadow-sm"
                                    >
                                      <Eye className="w-3.5 h-3.5 shrink-0" /> Open
                                    </button>

                                    <button 
                                      onClick={() => setMaterialItemHoldMenu({ materialId: mat.id, x: 0, y: 0 })}
                                      className="text-[10px] font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-600 hover:text-white border border-amber-500/20 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 w-full whitespace-nowrap overflow-hidden text-ellipsis shadow-sm"
                                      title="Organize into folder"
                                    >
                                      <Folder className="w-3.5 h-3.5 shrink-0" /> Move
                                    </button>

                                    <button 
                                      onClick={() => {
                                        setPreviewMaterial(mat);
                                        incrementViewsMaterial(mat);
                                      }}
                                      className="text-[10px] font-bold text-white bg-indigo-500/20 hover:bg-indigo-600 border border-indigo-500/30 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 w-full whitespace-nowrap overflow-hidden text-ellipsis shadow-sm"
                                    >
                                      🔍 Preview
                                    </button>

                                    <button 
                                      onClick={() => setShareMaterial(shareMaterial === mat ? null : mat)}
                                      className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-600 hover:text-white border border-emerald-500/20 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 w-full whitespace-nowrap overflow-hidden text-ellipsis shadow-sm"
                                    >
                                      <span>🟢</span> Share
                                    </button>

                                    <button 
                                      onClick={() => toggleLikeMaterial(mat)}
                                      className={`text-[10px] font-bold px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 border w-full whitespace-nowrap overflow-hidden text-ellipsis shadow-sm ${isLiked ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-white/5 border-white/5 hover:border-rose-500/20 text-slate-300'}`}
                                    >
                                      <Heart className={`w-3.5 h-3.5 shrink-0 ${isLiked ? 'fill-current text-rose-450' : ''}`} /> {mat.likes || 0}
                                    </button>

                                    <button 
                                      onClick={() => toggleBookmarkMaterial(mat.id)}
                                      className={`text-[10px] font-bold px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 border w-full whitespace-nowrap overflow-hidden text-ellipsis shadow-sm ${isSaved ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/5 text-slate-300 hover:border-amber-400/20'}`}
                                    >
                                      <Bookmark className={`w-3.5 h-3.5 shrink-0 ${isSaved ? 'fill-current' : ''}`} /> {isSaved ? 'Saved' : 'Save'}
                                    </button>

                                    <button 
                                      onClick={() => {
                                        setActiveCommentsMaterialId(activeCommentsMaterialId === mat.id ? null : mat.id);
                                        // Increment views passively when engaging with comment threads
                                        incrementViewsMaterial(mat);
                                      }}
                                      className="text-[10px] font-bold bg-white/5 border border-white/5 text-slate-300 hover:border-indigo-400/20 px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 w-full whitespace-nowrap overflow-hidden text-ellipsis shadow-sm"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> ({mat.comments?.length || 0})
                                    </button>
                                  </div>

                                  {effectiveRole === 'teacher' && (
                                    <div className="flex gap-1.5 w-full xl:w-auto mt-2 xl:mt-0">
                                      <button 
                                        onClick={() => handleVerifyMaterial(mat)}
                                        className={`flex-1 xl:flex-none flex items-center justify-center text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border transition-all ${mat.isVerified ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'}`}
                                      >
                                        {mat.isVerified ? '✓ Verified' : 'Verify'}
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          if (confirm(`Revoke / delete resource "${mat.title}" from vault databases permanently?`)) {
                                            try {
                                              const { deleteDoc, doc } = await import('firebase/firestore');
                                              await deleteDoc(doc(db, 'materials', mat.id));
                                              showNotification('Resource removed from academic hub.');
                                            } catch (err) {
                                              handleFirestoreError(err, OperationType.DELETE, `materials/${mat.id}`);
                                            }
                                          }
                                        }}
                                        className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all text-red-400 text-xs"
                                        title="Delete Material"
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* WhatsApp Style Forward Interface */}
                                {shareMaterial === mat && (
                                  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-left">
                                    <div className="bg-[#0b141a] border border-emerald-500/25 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col h-[520px]">
                                      {/* Header */}
                                      <div className="bg-[#1f2c34] px-5 py-4 border-b border-white/5 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                          <span className="text-xl">🟢</span>
                                          <div>
                                            <h4 className="text-sm font-black text-white">Forward with WhatsApp Share</h4>
                                            <p className="text-[10px] text-emerald-400 font-extrabold uppercase mt-0.5 tracking-wider">Share to Class Chat Rooms</p>
                                          </div>
                                        </div>
                                        <button 
                                          onClick={() => setShareMaterial(null)}
                                          className="text-slate-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>

                                      {/* Document info preview */}
                                      <div className="p-4 bg-[#111b21] border-b border-white/5">
                                        <div className="p-3 rounded-2xl bg-[#1f2c34]/50 border border-emerald-500/10 flex items-center gap-3">
                                          <span className="text-2xl">📁</span>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-black text-white truncate">{mat.title}</p>
                                            <p className="text-[9px] text-[#8696a0] truncate uppercase">{mat.subject} • {mat.type}</p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Chat Search */}
                                      <div className="px-4 py-2 bg-[#0b141a]">
                                        <input
                                          type="text"
                                          placeholder="Search chat group or friend..."
                                          className="w-full bg-[#1f2c34] border border-transparent rounded-xl px-4.5 py-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                          onChange={(e) => {
                                            (window as any)._waShareQuery = e.target.value;
                                            setChats([...chats]); // force re-render
                                          }}
                                        />
                                      </div>

                                      {/* Rooms list scroll */}
                                      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 scrollbar-thin">
                                        {chatRooms
                                          .filter(room => {
                                            const queryStr = ((window as any)._waShareQuery || '').toLowerCase();
                                            if (!queryStr) return true;
                                            return room.name.toLowerCase().includes(queryStr) || room.type.includes(queryStr);
                                          })
                                          .map((room) => {
                                            return (
                                              <button
                                                key={room.id}
                                                onClick={() => {
                                                  const capElement = document.getElementById(`share-caption-${mat.id}`) as HTMLInputElement;
                                                  const customCap = capElement?.value?.trim();
                                                  if (customCap) {
                                                    handleShareMaterialToChat({ ...mat, title: `${mat.title} (${customCap})` }, room.id);
                                                  } else {
                                                    handleShareMaterialToChat(mat, room.id);
                                                  }
                                                  setShareMaterial(null);
                                                }}
                                                className="w-full text-left p-3 rounded-2xl bg-[#111b21] border border-white/5 hover:border-emerald-500/20 hover:bg-[#1f2c34]/40 transition-all flex items-center justify-between gap-3 group active:scale-99"
                                              >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                  <span className="text-xl p-2 bg-[#1f2c34] rounded-full">{room.icon}</span>
                                                  <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-xs font-bold text-white truncate">{room.name}</span>
                                                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${
                                                        room.type === 'friend' ? 'bg-teal-500/10 text-teal-400' :
                                                        room.type === 'channel' ? 'bg-rose-500/10 text-rose-400' : 'bg-[#25d366]/10 text-[#25d366]'
                                                      }`}>{room.type}</span>
                                                    </div>
                                                    <p className="text-[10px] text-[#8696a0] truncate mt-0.5">{room.description}</p>
                                                  </div>
                                                </div>
                                                
                                                <div className="text-[10px] bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-bold group-hover:bg-emerald-600 group-hover:text-white transition-all flex items-center gap-1 shrink-0">
                                                  <span>🟢</span> Share
                                                </div>
                                              </button>
                                            );
                                          })}
                                      </div>

                                      {/* Footer caption helper */}
                                      <div className="p-4 bg-[#1f2c34] border-t border-white/5 flex gap-2">
                                        <input 
                                          id={`share-caption-${mat.id}`}
                                          type="text"
                                          placeholder="Type a custom message or caption..."
                                          className="flex-1 bg-[#111b21] border border-[#2a3942] rounded-xl px-4 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        />
                                        <button
                                          onClick={() => {
                                            const inp = document.getElementById(`share-caption-${mat.id}`) as HTMLInputElement;
                                            const cap = inp?.value?.trim() || `Shared: "${mat.title}"`;
                                            // Forward with caption custom content added
                                            handleShareMaterialToChat({ ...mat, title: `${mat.title} - ${cap}` }, activeChatTargetId);
                                            if (inp) inp.value = '';
                                            setShareMaterial(null);
                                          }}
                                          className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1 shrink-0"
                                        >
                                          Quick Share ➜
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Collapsible Comments Panel */}
                                {activeCommentsMaterialId === mat.id && (
                                  <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/5 space-y-3 animate-fadeIn">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                      <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">💬 Peer Discussion Thread</h5>
                                    </div>
                                    
                                    {/* History list */}
                                    <div className="space-y-2.5 max-h-40 overflow-y-auto scrollbar-thin">
                                      {(mat.comments || []).map((comm) => {
                                        let commBadge = '';
                                        if (comm.house === 'Ruby') commBadge = '🟥 ';
                                        else if (comm.house === 'Emerald') commBadge = '🟩 ';
                                        else if (comm.house === 'Sapphire') commBadge = '🟦 ';
                                        else if (comm.house === 'Topaz') commBadge = '🟨 ';

                                        return (
                                          <div key={comm.id} className="text-xs bg-slate-900/60 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                                            <div className="flex justify-between items-center text-[9px] text-slate-450 font-bold mb-1">
                                              <span>{commBadge}{comm.author}</span>
                                              <span>{comm.createdAt}</span>
                                            </div>
                                            <p className="text-slate-200">{comm.text}</p>
                                          </div>
                                        );
                                      })}
                                      {(mat.comments || []).length === 0 && (
                                        <p className="text-[10px] text-slate-500 italic py-1 text-center">No messages posted. Be the first to start the masterclass discussion!</p>
                                      )}
                                    </div>

                                    {/* Submit box */}
                                    <div className="flex gap-2">
                                      <input 
                                        type="text" 
                                        value={newCommentText}
                                        onChange={e => setNewCommentText(e.target.value)}
                                        placeholder="Type doubt, solution, or revision note..."
                                        className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddComment(mat); }}
                                      />
                                      <button 
                                        onClick={() => handleAddComment(mat)}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 rounded-xl transition-all"
                                      >
                                        Post
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Collapsible AI Operations Panel */}
                                <div className="mt-3.5 pt-3.5 border-t border-white/5 space-y-2">
                                  <div className="flex items-center justify-between text-[9px] font-black uppercase text-indigo-400">
                                    <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 animate-pulse text-indigo-400" /> Campus AI Tutor Integration</span>
                                  </div>

                                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 text-[10px]">
                                    <button 
                                      onClick={() => handleTriggerMaterialAi(mat, 'summarize')}
                                      className="bg-white/5 hover:bg-indigo-600/10 border border-white/5 hover:border-indigo-500/20 px-3 py-1.5 rounded-xl transition-colors text-slate-300 hover:text-white font-bold text-left sm:text-center flex-1"
                                    >
                                      ✨ Summarize
                                    </button>
                                    <button 
                                      onClick={() => handleTriggerMaterialAi(mat, 'quiz')}
                                      className="bg-white/5 hover:bg-indigo-600/10 border border-white/5 hover:border-indigo-500/20 px-3 py-1.5 rounded-xl transition-colors text-slate-300 hover:text-white font-bold text-left sm:text-center flex-1"
                                    >
                                      🧠 Generate Quiz
                                    </button>
                                    <button 
                                      onClick={() => handleTriggerMaterialAi(mat, 'explain')}
                                      className="bg-white/5 hover:bg-indigo-600/10 border border-white/5 hover:border-indigo-500/20 px-3 py-1.5 rounded-xl transition-colors text-slate-300 hover:text-white font-bold text-left sm:text-center flex-1"
                                    >
                                      📖 Explain Chapter
                                    </button>
                                    <button 
                                      onClick={() => handleTriggerMaterialAi(mat, 'revision')}
                                      className="bg-white/5 hover:bg-indigo-600/10 border border-white/5 hover:border-indigo-500/20 px-3 py-1.5 rounded-xl transition-colors text-slate-300 hover:text-white font-bold text-left sm:text-center flex-1"
                                    >
                                      📓 Revision Notes
                                    </button>
                                    <button 
                                      onClick={() => handleTriggerMaterialAi(mat, 'questions')}
                                      className="bg-white/5 hover:bg-indigo-600/10 border border-white/5 hover:border-indigo-500/20 px-3 py-1.5 rounded-xl transition-colors text-slate-300 hover:text-white font-bold text-left sm:text-center flex-1"
                                    >
                                      🎯 Imp Questions
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setSelectedMaterialForAi(mat);
                                        setAiActionType('ask');
                                        setAiActionResultText('Type a question inside the terminal block below to cross-evaluate document content!');
                                      }}
                                      className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold px-3 py-1.5 rounded-xl text-left sm:text-center flex-1 hover:bg-indigo-600 hover:text-white transition-all"
                                    >
                                      🤖 Ask AI...
                                    </button>
                                  </div>
                                </div>

                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                    {/* Left Column: Easy Quick Share & Leaderboard */}
                    <div className="lg:col-span-4 space-y-6">
                      
                      {/* Quick Resource Uploader Widget */}
                      <div className="smart-glass p-6 rounded-3xl space-y-4 border border-indigo-500/15">
                        <div className="space-y-1">
                          <h3 className="text-base font-extrabold font-display text-white flex items-center gap-1.5">📤 Quick Share Vault</h3>
                          <p className="text-xs text-slate-400">Share textbook photos, notes, diagrams, or papers with peers instantly.</p>
                        </div>

                        <form onSubmit={handleQuickUploadSubmit} className="space-y-3">
                          {/* File Dropzone */}
                          <div 
                            onDragEnter={handleQuickUploadDrag}
                            onDragOver={handleQuickUploadDrag}
                            onDragLeave={handleQuickUploadDrag}
                            onDrop={handleQuickUploadDrop}
                            className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
                              quickUploadDragActive 
                                ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' 
                                : 'border-white/10 hover:border-indigo-500/40 bg-slate-950/40 hover:bg-slate-950/60'
                            }`}
                            onClick={() => document.getElementById('quick-file-upload-input')?.click()}
                          >
                            <input 
                              type="file" 
                              id="quick-file-upload-input" 
                              className="hidden" 
                              onChange={handleQuickUploadFileChange}
                            />
                            {quickUploadFile ? (
                              <div className="space-y-1 animate-fadeIn">
                                <span className="text-3xl block">📄</span>
                                <p className="text-xs font-black text-indigo-400 truncate max-w-[220px] mx-auto">{quickUploadFile.name}</p>
                                <p className="text-[10px] text-slate-500">{(quickUploadFile.size / 1024 / 1024).toFixed(2)} MB • Click to change</p>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Upload className="w-7 h-7 mx-auto text-indigo-400 p-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg animate-bounce mb-1" />
                                <p className="text-xs font-bold text-white">Click or drag & drop file</p>
                                <span className="text-[10px] text-slate-500 block">Notes, Sheets, Images up to 50MB</span>
                              </div>
                            )}
                          </div>

                          {quickUploadFile && (
                            <div className="space-y-3 animate-fadeIn">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Resource Title *</label>
                                <input 
                                  type="text"
                                  value={quickUploadTitle}
                                  onChange={e => setQuickUploadTitle(e.target.value)}
                                  placeholder="Name your shared study resource..."
                                  required
                                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject</label>
                                  <select 
                                    value={quickUploadSubject}
                                    onChange={e => setQuickUploadSubject(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none"
                                  >
                                    <option value="Mathematics">Mathematics</option>
                                    <option value="Physics">Physics</option>
                                    <option value="Chemistry">Chemistry</option>
                                    <option value="Biology">Biology</option>
                                    <option value="Computer Science">Comp Science</option>
                                    <option value="English">English</option>
                                    <option value="Social Science">Social Sci</option>
                                    <option value="General">General</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Format Type</label>
                                  <select 
                                    value={quickUploadType}
                                    onChange={e => setQuickUploadType(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none"
                                  >
                                    <option value="notes">Notes</option>
                                    <option value="image">Diagram / Image</option>
                                    <option value="pdf">PDF File</option>
                                    <option value="ppt">PPT/Slide</option>
                                    <option value="assignment">Assignment</option>
                                    <option value="question-paper">Question Paper</option>
                                  </select>
                                </div>
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickUploadFile(null);
                                    setQuickUploadTitle('');
                                  }}
                                  className="flex-1 py-1.5 rounded-xl text-[10px] font-semibold bg-white/5 border border-white/5 text-slate-400 hover:text-white transition-all text-center"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={quickUploadIsUploading}
                                  className={`flex-1 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold uppercase tracking-wide transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 ${quickUploadIsUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                  {quickUploadIsUploading ? (
                                    <>
                                      <span className="w-3.5 h-3.5 border-2 border-white/25 border-t-white rounded-full animate-spin"></span>
                                      Publishing...
                                    </>
                                  ) : (
                                    '🚀 Share'
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </form>
                      </div>

                      {/* Active House Leaderboard for Material Hub Standings */}
                      <div className="smart-glass p-5 rounded-3xl space-y-4">
                        <div className="space-y-2">
                          <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#facc15] flex items-center gap-1.5">🏆 Competitive House stand</h4>
                          <p className="text-[11px] text-slate-400 leading-normal">Contribute, comments, downloads and verified works to elevate your house alliance stand!</p>
                        </div>
                        <div className="space-y-2">
                          {Object.entries({
                            Ruby: { pts: housePoints.Ruby || 750, col: 'text-red-400 bg-red-500/10 border-red-500/20' },
                            Emerald: { pts: housePoints.Emerald || 820, col: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                            Sapphire: { pts: housePoints.Sapphire || 910, col: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                            Topaz: { pts: housePoints.Topaz || 685, col: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
                          }).map(([house, details]) => (
                            <div key={house} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-black/25 border border-white/5">
                              <span className="font-bold">{house === 'Ruby' ? '🟥' : house === 'Emerald' ? '🟩' : house === 'Sapphire' ? '🟦' : '🟨'} {house} House</span>
                              <span className="font-mono text-slate-300 font-extrabold">{details.pts} SP</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Dynamic interactive AI analysis Drawer Modal */}
                  {selectedMaterialForAi && (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="relative bg-slate-900 border border-white/10 max-w-2xl w-full rounded-3xl shadow-2xl overflow-hidden animate-zoomIn max-h-[85vh] flex flex-col justify-between">
                        
                        {/* Header */}
                        <div className="p-6 bg-gradient-to-r from-indigo-500/10 to-transparent border-b border-white/5 flex justify-between items-start">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">Faculty AI Agent</span>
                            <h4 className="text-base font-black text-white font-display leading-snug">{selectedMaterialForAi.title}</h4>
                            <p className="text-[11px] text-slate-400 uppercase tracking-widest font-mono">Process: {aiActionType.toUpperCase()}</p>
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedMaterialForAi(null);
                              setAiUserQuestion('');
                            }}
                            className="bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded-xl transition-colors border border-white/5"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Scrollable text container */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                          
                          {aiActionLoading ? (
                            <div className="py-12 text-center space-y-3">
                              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                              <p className="text-xs text-indigo-400 animate-pulse uppercase font-black tracking-widest">Compiling database vectors & loading study answers...</p>
                            </div>
                          ) : (
                            <div className="space-y-4 text-slate-200 text-xs leading-relaxed font-sans whitespace-pre-wrap">
                              {aiActionResultText || 'No result parsed.'}
                            </div>
                          )}

                          {/* Ask input if in "ask" mode */}
                          {aiActionType === 'ask' && !aiActionLoading && (
                            <div className="p-4 bg-slate-950/40 rounded-2xl border border-white/5 space-y-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ask Custom Question Related to this resource:</label>
                              <div className="flex gap-2">
                                <input 
                                  type="text" 
                                  value={aiUserQuestion}
                                  onChange={e => setAiUserQuestion(e.target.value)}
                                  placeholder="e.g. Can you explain AVL balance factors or list formulas?"
                                  className="flex-1 text-xs bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button 
                                  onClick={() => handleTriggerMaterialAi(selectedMaterialForAi, 'ask')}
                                  className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl transition-all"
                                >
                                  Submit query
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Export Action Footer */}
                        {!aiActionLoading && aiActionResultText && (
                          <div className="p-5 bg-slate-950 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3">
                            <span className="text-[10px] text-slate-500 font-mono">Format matching: Printable ANSI Markdown text</span>
                            <div className="flex gap-2 w-full sm:w-auto justify-end">
                              <button 
                                onClick={() => handleExportAiResult(selectedMaterialForAi, 'txt')}
                                className="text-xs font-bold bg-white/5 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/5 transition-colors flex-1 sm:flex-initial"
                              >
                                Export TXT
                              </button>
                              <button 
                                onClick={() => handleExportAiResult(selectedMaterialForAi, 'html')}
                                className="text-xs font-bold bg-white/5 text-slate-305 hover:text-white px-3 py-1.5 rounded-xl border border-white/5 transition-colors flex-1 sm:flex-initial"
                              >
                                Export HTML Pages
                              </button>
                              <button 
                                onClick={() => handleExportAiResult(selectedMaterialForAi, 'pdf')}
                                className="text-xs font-bold bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-xl border border-indigo-500/20 transition-colors flex-1 sm:flex-initial"
                              >
                                Get Printable PDF
                              </button>
                            </div>
                          </div>
                        )}
                        
                      </div>
                    </div>
                  )}

                  {/* Interactive Material Preview Modal & AI Assistance */}
                  {previewMaterial && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
                      <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto text-left">
                        
                        {/* Close button */}
                        <button 
                          onClick={() => setPreviewMaterial(null)}
                          className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors border border-white/5"
                        >
                          ✕
                        </button>

                        {/* Heading summary */}
                        <div className="flex items-start gap-3 border-b border-white/5 pb-4">
                          <span className="text-3xl p-2 bg-indigo-500/10 border border-indigo-500/15 rounded-2xl block">📁</span>
                          <div>
                            <span className="text-[10px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">
                              {previewMaterial.subject} • {previewMaterial.type}
                            </span>
                            <h3 className="text-base font-extrabold text-white mt-1 leading-normal">{previewMaterial.title}</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Shared by {previewMaterial.uploadedBy} • {previewMaterial.createdAt}</p>
                            <button
                              onClick={() => {
                                setInAppViewerDoc({
                                  url: previewMaterial.url,
                                  title: previewMaterial.title,
                                  fileName: previewMaterial.fileName,
                                  fileType: previewMaterial.fileType
                                });
                                setPreviewMaterial(null);
                              }}
                              className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow"
                            >
                              <Eye className="w-3.5 h-3.5" /> Open in Learning Workspace Viewer
                            </button>
                          </div>
                        </div>

                        {/* Internal reading slot */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          
                          {/* Left Column: Real Document Viewer Frame */}
                          <div className="space-y-3.5 bg-slate-950 p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                            <div className="space-y-2 h-full flex flex-col">
                              <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1.5">
                                <span className="font-bold flex items-center gap-1">📖 Integrated Viewer Engine</span>
                                <span className="font-mono text-cyan-300 uppercase tracking-widest">{previewMaterial.fileName?.split(',').pop() || previewMaterial.type || 'DOCUMENT'}</span>
                              </div>

                              {previewMaterial.url?.startsWith('blob:') ? (
                                <div className="w-full h-[300px] rounded-xl border border-rose-500/30 bg-rose-950/20 flex flex-col items-center justify-center p-4 text-center shadow-inner">
                                  <div className="text-4xl mb-4 text-rose-500">⚠️</div>
                                  <p className="text-rose-400 font-bold mb-2">Legacy Material Format Detected</p>
                                  <p className="text-rose-300 text-[10px] max-w-[250px]">This material was uploaded before the Supabase migration and must be re-uploaded.</p>
                                </div>
                              ) : previewMaterial.fileType?.startsWith('video/') || (previewMaterial.url && previewMaterial.url.toLowerCase().match(/\.(mp4|webm|ogg)$/)) ? (
                                <div className="w-full h-[300px] rounded-xl overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center p-2 shadow-inner">
                                  <video controls className="max-h-full max-w-full">
                                    <source src={previewMaterial.url} type={previewMaterial.fileType || 'video/mp4'} />
                                    Your browser does not support the video tag.
                                  </video>
                                </div>
                              ) : previewMaterial.fileType?.startsWith('audio/') || (previewMaterial.url && previewMaterial.url.toLowerCase().match(/\.(mp3|wav|ogg)$/)) ? (
                                <div className="w-full h-[300px] rounded-xl border border-white/10 bg-slate-900 flex flex-col items-center justify-center p-4">
                                  <div className="text-4xl mb-4">🎵</div>
                                  <audio controls className="w-full max-w-sm">
                                    <source src={previewMaterial.url} type={previewMaterial.fileType || 'audio/mpeg'} />
                                    Your browser does not support the audio element.
                                  </audio>
                                </div>
                              ) : previewMaterial.url && (previewMaterial.url.toLowerCase().includes('.pdf') || previewMaterial.type === 'pdf' || previewMaterial.fileType === 'application/pdf') ? (
                                <div className="w-full h-[300px] rounded-xl border border-white/10 bg-slate-900 overflow-hidden relative">
                                  <PdfCanvasViewer url={previewMaterial.url} title={previewMaterial.title} onDownload={() => handleDownloadMaterial(previewMaterial)} />
                                </div>
                              ) : previewMaterial.url && (previewMaterial.url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|svg)$/) !== null || previewMaterial.type === 'image' || previewMaterial.fileType?.startsWith('image/')) ? (
                                <div className="w-full h-[285px] rounded-xl overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center p-2 shadow-inner">
                                  {(() => {
                                    console.log("[DEBUG] Preview URL:", previewMaterial.url);
                                    return (
                                      <img 
                                        src={previewMaterial.url} 
                                        alt="Attachment Visual Preview"
                                        className="max-h-full max-w-full object-contain roundedReferral" 
                                        referrerPolicy="no-referrer"
                                        onError={(e) => console.error("[DEBUG] Image load error:", e)}
                                      />
                                    );
                                  })()}
                                </div>
                              ) : (
                                <div className="p-4 bg-slate-900 border border-white/5 rounded-xl text-xs space-y-3 font-serif min-h-[220px] max-h-[285px] text-slate-350 leading-relaxed overflow-y-auto select-none">
                                  <h4 className="font-bold text-center text-xs border-b border-white/5 pb-1 text-white truncate px-2">{previewMaterial.fileName || previewMaterial.title}</h4>
                                  <div className="space-y-4 pt-4 flex flex-col items-center justify-center h-full">
                                    <div className="text-4xl text-slate-500">📎</div>
                                    <p className="text-[11px] bg-slate-950/60 p-3 rounded-lg text-slate-400 border border-white/5 italic text-center leading-relaxed">
                                      This file format cannot be previewed directly in the browser.<br/><br/>
                                      <span className="text-indigo-400 font-bold block mt-2">Document Type: {previewMaterial.fileType || previewMaterial.type || 'Unknown Format'}</span>
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-white/5 mt-auto">
                              <span>👁️ {previewMaterial.views || 0} views</span>
                              <span>📥 {previewMaterial.downloads || 0} downloads</span>
                            </div>
                          </div>

                          {/* Right Column: AI Helpers & Quick actions drawer */}
                          <div className="space-y-4 flex flex-col justify-between">
                            
                            <div className="space-y-2.5">
                              <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">💡 Study Helpers & AI Companion</h4>
                              
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <button 
                                  onClick={() => {
                                    setSelectedMaterialForAi(previewMaterial);
                                    setAiActionType('summarize');
                                    handleTriggerMaterialAi(previewMaterial, 'summarize');
                                  }}
                                  className="bg-white/5 hover:bg-indigo-600/10 border border-white/5 p-2.5 rounded-xl text-slate-300 font-bold hover:text-white transition-all text-center"
                                >
                                  ✨ Summarize File
                                </button>
                                <button 
                                  onClick={() => {
                                    setSelectedMaterialForAi(previewMaterial);
                                    setAiActionType('explain');
                                    handleTriggerMaterialAi(previewMaterial, 'explain');
                                  }}
                                  className="bg-white/5 hover:bg-indigo-600/10 border border-white/5 p-2.5 rounded-xl text-slate-300 font-bold hover:text-white transition-all text-center"
                                >
                                  📖 Explain Document
                                </button>
                              </div>
                              
                              {/* If AI output is ready and matches current file preview, render inside */}
                              {selectedMaterialForAi?.id === previewMaterial.id && aiActionResultText && (
                                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-slate-300 max-h-28 overflow-y-auto scrollbar-thin">
                                  <span className="font-extrabold text-[#facc15] uppercase text-[8px] block mb-1">🤖 Campus AI Tutor Output:</span>
                                  <p className="leading-relaxed whitespace-pre-wrap">{aiActionResultText}</p>
                                </div>
                              )}
                              
                              {!aiActionResultText && (
                                <p className="text-[10px] text-slate-500 italic">Select an AI action above. The smart tutor will scan this revision sheet and provide responses instantly.</p>
                              )}
                            </div>

                            {/* Easy Share button to whatsapp styled channel targets */}
                            <div className="space-y-2 pt-2.5 border-t border-white/5">
                              <h4 className="text-[10px] font-black uppercase text-emerald-450 tracking-wider">🟢 Quick Share to Class Chat Rooms:</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { id: 'group-all', name: '🌍 General' },
                                  { id: 'group-math', name: '📐 Math Club' },
                                  { id: 'group-ruby', name: '🟥 Ruby House' },
                                  { id: 'group-emerald', name: '🟩 Emerald House' }
                                ].map(room => (
                                  <button
                                    key={room.id}
                                    onClick={() => {
                                      handleShareMaterialToChat(previewMaterial, room.id);
                                      showNotification(`Shared "${previewMaterial.title}" directly to ${room.name}`);
                                    }}
                                    className="bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white text-emerald-400 px-2.5 py-1.5 rounded-xl text-[9px] font-black tracking-wide text-center transition-all inline-block hover:scale-103"
                                  >
                                    Share to {room.name}
                                  </button>
                                ))}
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                          <button 
                            onClick={() => handleDownloadMaterial(previewMaterial)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all block"
                          >
                            📥 Download Original Link
                          </button>
                          <button 
                            onClick={() => setPreviewMaterial(null)}
                            className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs px-5 py-2.5 rounded-xl transition-all block"
                          >
                            Close Preview
                          </button>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* Create / Upload Custom Material Popup Modal */}
                  {openUploadModal && (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="bg-slate-900 border border-white/10 max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden animate-zoomIn">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                          <div className="space-y-0.5">
                            <h4 className="text-base font-black text-white font-display leading-tight">Publish Academic Core Resource</h4>
                            <p className="text-xs text-slate-400">Add pdf, spreadsheets, question papers, or notes.</p>
                          </div>
                          <button 
                            onClick={() => setOpenUploadModal(false)}
                            className="bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded-xl transition-colors border border-white/5"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleUploadFileMaterial} className="p-6 space-y-4 text-xs">
                          
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Resource Name / Title *</label>
                            <input 
                              id="upload-title"
                              required
                              type="text" 
                              placeholder="e.g. Mathematics Sem 2 Calculus, BST exam preparation..."
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Category Subject *</label>
                              <select 
                                id="upload-subject"
                                required
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none"
                              >
                                <option value="Mathematics">Mathematics</option>
                                <option value="Physics">Physics</option>
                                <option value="Chemistry">Chemistry</option>
                                <option value="Biology">Biology</option>
                                <option value="Computer Science">Computer Science</option>
                                <option value="English">English</option>
                                <option value="Social Science">Social Science</option>
                                <option value="General">General/Other</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Resource Type *</label>
                              <select 
                                id="upload-type"
                                required
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                              >
                                <option value="pdf">PDF File</option>
                                <option value="ppt">PPT slide deck</option>
                                <option value="doc">Word Doc</option>
                                <option value="image">Diagram Image</option>
                                <option value="notes">Lecture Notes</option>
                                <option value="assignment">Assignment Sheets</option>
                                <option value="question-paper">Exam Question Paper</option>
                                <option value="project">Project Work</option>
                              </select>
                            </div>
                          </div>

                          {/* Year field for question papers */}
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Question Paper Year (Optional)</label>
                            <input 
                              id="upload-year"
                              type="text" 
                              placeholder="e.g. 2025, 2024 (Only if question paper format)"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Resource Summary Description *</label>
                            <textarea 
                              id="upload-desc"
                              required
                              rows={3}
                              placeholder="Describe coverage parameters, key concepts, and instructions..."
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none font-sans"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Academic File Content Attachment</label>
                            <input 
                              id="upload-file"
                              type="file" 
                              className="w-full bg-slate-950 text-slate-400 text-xs px-3 py-2.5 rounded-xl border border-white/10 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                            />
                          </div>

                          {/* Granular Permissions Section */}
                          <div className="p-3 bg-slate-950/80 rounded-2xl border border-white/5 space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-extrabold uppercase text-slate-400">
                              <span>Privacy Restrictions (Audience TARGETS)</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={!newMaterialIsPublic} 
                                  onChange={() => setNewMaterialIsPublic(!newMaterialIsPublic)} 
                                  className="sr-only peer"
                                />
                                <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-350 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                <span className="ml-2 text-[9px] text-slate-500">{newMaterialIsPublic ? 'Public' : 'Custom'}</span>
                              </label>
                            </div>

                            {!newMaterialIsPublic && (
                              <div className="space-y-2 border-t border-white/5 pt-2 animate-fadeIn text-[9px]">
                                {effectiveRole !== 'student' && (
                                  <div className="space-y-1">
                                    <p className="font-bold text-indigo-400 uppercase">Material Visibility Domain:</p>
                                    <select 
                                      value={newMaterialVisibility}
                                      onChange={(e) => setNewMaterialVisibility(e.target.value as any)}
                                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2 py-1.5 text-white"
                                    >
                                      <option value="student">Student Portal (Visible to Everyone)</option>
                                      <option value="teacher">Teacher Vault (Staff Only)</option>
                                      <option value="private">Private (Only Me)</option>
                                    </select>
                                  </div>
                                )}
                                
                                {newMaterialVisibility === 'student' && (
                                  <>
                                    <div className="space-y-1">
                                      <p className="font-bold text-indigo-400 uppercase">Visible to Grade Levels:</p>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => {
                                          const isSel = newMaterialGrades.includes(g);
                                          return (
                                            <button 
                                              type="button" 
                                              key={g}
                                              onClick={() => setNewMaterialGrades(prev => isSel ? prev.filter(x => x !== g) : [...prev, g])}
                                              className={`px-2 py-0.5 rounded-lg border font-bold transition-all ${isSel ? 'bg-indigo-600 text-white border-indigo-500 shadow' : 'bg-slate-900 text-slate-400 border-white/5 hover:text-white'}`}
                                            >
                                              {g}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <p className="font-bold text-indigo-400 uppercase">Visible to Section Groups:</p>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {['Astra', 'Elara', 'Solara', 'Vega'].map(sec => {
                                          const isSel = newMaterialSections.includes(sec);
                                          return (
                                            <button 
                                              type="button" 
                                              key={sec}
                                              onClick={() => setNewMaterialSections(prev => isSel ? prev.filter(x => x !== sec) : [...prev, sec])}
                                              className={`px-2 py-0.5 rounded-lg border font-bold transition-all ${isSel ? 'bg-indigo-600 text-white border-indigo-500 shadow' : 'bg-slate-900 text-slate-400 border-white/5 hover:text-white'}`}
                                            >
                                              {sec}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <p className="font-bold text-indigo-400 uppercase">Visible to Houses:</p>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {['Ruby', 'Emerald', 'Sapphire', 'Topaz'].map(h => {
                                          const isSel = newMaterialHouses.includes(h);
                                          return (
                                            <button 
                                              type="button" 
                                              key={h}
                                              onClick={() => setNewMaterialHouses(prev => isSel ? prev.filter(x => x !== h) : [...prev, h])}
                                              className={`px-2 py-0.5 rounded-lg border font-bold transition-all ${isSel ? 'bg-indigo-600 text-white border-indigo-500 shadow' : 'bg-slate-900 text-slate-400 border-white/5'}`}
                                            >
                                              {h}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <button 
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold uppercase py-3 rounded-2xl tracking-wider transition-all shadow-lg active:scale-95"
                          >
                            🚀 Publish Material to Vaults
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Material Folder Creation Modal */}
                  {showMaterialFolderModal && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-left">
                      <div className="bg-slate-900 border border-white/10 p-5 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                            <span>📁</span> Create Material Folder
                          </h4>
                          <button onClick={() => setShowMaterialFolderModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
                            <X size={16} />
                          </button>
                        </div>
                        <p className="text-xs text-slate-400">Folders in Material Hub store files, documents, and question papers only.</p>
                        <input
                          type="text"
                          placeholder="Folder name (e.g. Physics Past Papers)"
                          value={newMaterialFolderName}
                          onChange={(e) => setNewMaterialFolderName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateMaterialFolder()}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => setShowMaterialFolderModal(false)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateMaterialFolder}
                            disabled={!newMaterialFolderName.trim()}
                            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Material Folder Rename Modal */}
                  {renameMaterialFolderModal && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-left">
                      <div className="bg-slate-900 border border-white/10 p-5 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                            <span>✏️</span> Rename Folder
                          </h4>
                          <button onClick={() => setRenameMaterialFolderModal(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
                            <X size={16} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={renameMaterialInput}
                          onChange={(e) => setRenameMaterialInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameMaterialFolder()}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => setRenameMaterialFolderModal(null)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleRenameMaterialFolder}
                            disabled={!renameMaterialInput.trim()}
                            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Move File to Folder Modal / Bottom Sheet */}
                  {materialItemHoldMenu && (
                    <>
                      {/* Mobile Bottom Sheet */}
                      <div className="md:hidden">
                        <BottomSheet 
                          isOpen={!!materialItemHoldMenu} 
                          onClose={() => setMaterialItemHoldMenu(null)}
                          title="Move File to Folder"
                        >
                          <div className="space-y-3">
                            <button
                              onClick={() => handleMoveMaterialToFolder(materialItemHoldMenu.materialId, null)}
                              className="w-full text-left p-4 rounded-2xl border border-white/5 bg-slate-950/60 text-white flex items-center gap-3 text-sm font-bold"
                            >
                              <span className="text-xl">🏠</span>
                              <span>Root (No Folder)</span>
                            </button>
                            
                            {materialFolders.map(folder => (
                              <button
                                key={folder.id}
                                onClick={() => handleMoveMaterialToFolder(materialItemHoldMenu.materialId, folder.id)}
                                className="w-full text-left p-4 rounded-2xl border border-white/5 bg-slate-950/60 text-white flex items-center justify-between text-sm font-bold"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xl">📁</span>
                                  <span>{folder.name}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {materials.filter(m => m.folder_id === folder.id).length} files
                                </span>
                              </button>
                            ))}
                          </div>
                        </BottomSheet>
                      </div>

                      {/* Desktop Modal */}
                      <div className="hidden md:flex fixed inset-0 bg-slate-950/80 backdrop-blur-sm items-center justify-center p-4 z-50 animate-fadeIn text-left">
                        <div className="bg-slate-900 border border-white/10 p-5 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Folder className="w-4 h-4 text-amber-400" />
                              <h4 className="text-xs font-black uppercase text-white tracking-wider">Move File to Folder</h4>
                            </div>
                            <button onClick={() => setMaterialItemHoldMenu(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
                              <X size={16} />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400">Choose a destination folder in Material Hub:</p>
                          
                          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            <button
                              onClick={() => handleMoveMaterialToFolder(materialItemHoldMenu.materialId, null)}
                              className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-slate-950/60 hover:bg-indigo-600/20 hover:border-indigo-500/30 text-white flex items-center justify-between text-xs font-bold transition-all"
                            >
                              <span className="flex items-center gap-2"><span>🏠</span> Root (No Folder)</span>
                            </button>
                            
                            {materialFolders.map(folder => (
                              <button
                                key={folder.id}
                                onClick={() => handleMoveMaterialToFolder(materialItemHoldMenu.materialId, folder.id)}
                                className="w-full text-left p-2.5 rounded-xl border border-white/5 bg-slate-950/60 hover:bg-amber-600/20 hover:border-amber-500/30 text-white flex items-center justify-between text-xs font-bold transition-all"
                              >
                                <span className="flex items-center gap-2"><span>📁</span> {folder.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {materials.filter(m => m.folder_id === folder.id).length} files
                                </span>
                              </button>
                            ))}

                            {materialFolders.length === 0 && (
                              <p className="text-center text-[10px] text-slate-500 py-3">No folders yet. Click "+ New Folder" at the top to create one.</p>
                            )}
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => setMaterialItemHoldMenu(null)}
                              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                    </>
                  )}
                </div>
              )}

              {/* Tab 5: StudentOS Brain Battle Mini-Game (replaces Interactive Quiz with backward route compatibility) */}
              {(activeTab === 'brain_battle' || activeTab === 'quiz') && (
                <BrainBattleArena
                  currentUser={currentUser}
                  effectiveRole={(effectiveRole as UserRole) || 'student'}
                  showNotification={showNotification}
                />
              )}

              {/* Tab 6: Collaborative Feedback Portal */}
              {activeTab === 'feedback' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Add feedback form pane */}
                    <div className="lg:col-span-4 space-y-6">
                      <div className="smart-glass p-6 rounded-3xl space-y-4 shadow-sm">
                        <div className="space-y-1">
                          <h3 className="font-extrabold text-base text-white">Create Campus Suggestion</h3>
                          <p className="text-xs text-slate-400">Post constructive notes about facilities, scheduling resources, or calendar conflicts.</p>
                        </div>

                        <form onSubmit={handleAddFeedback} className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400">Category Tag</label>
                            <select 
                              value={newFeedbackCategory} 
                              onChange={e => setNewFeedbackCategory(e.target.value as any)}
                              className="w-full text-xs px-3.5 py-3 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="facilities">🏫 Facilities & Labs</option>
                              <option value="academic">📚 Coursework Research</option>
                              <option value="events">🏆 House events & Challenges</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400">Feedback Details</label>
                            <textarea 
                              rows={4}
                              value={newFeedbackText}
                              onChange={e => setNewFeedbackText(e.target.value)}
                              placeholder="Please draft details constructively..." 
                              className="w-full p-3.5 text-xs rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                              required
                            />
                          </div>

                          <button 
                            type="submit"
                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wide uppercase transition-all shadow-md hover:scale-[1.01]"
                          >
                            🚀 Publish on Student Board
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Feed display pane */}
                    <div className="lg:col-span-8 space-y-4">
                      <div className="smart-glass p-6 rounded-3xl space-y-4">
                        <h3 className="text-lg font-black font-display text-white">Active Forums</h3>
                        
                        <div className="space-y-4">
                          {feedbackPosts.map(post => (
                            <div key={post.id} className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all space-y-3.5">
                              
                              {/* Header info */}
                              <div className="flex justify-between items-center flex-wrap gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{post.author}</span>
                                  <span className="text-[10px] text-slate-500 lowercase opacity-80 font-mono">({post.role})</span>
                                </div>
                                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/5 text-indigo-400 font-bold uppercase">{post.category}</span>
                                  <span className={`px-2 py-0.5 rounded uppercase font-bold tracking-wider ${post.status === 'solved' ? 'bg-emerald-500/20 text-emerald-400' : post.status === 'in-progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-840 text-slate-400'}`}>
                                    {post.status}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-slate-300 leading-relaxed">{post.text}</p>

                              {/* Footer action detail */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/5 text-xs">
                                <button 
                                  onClick={() => upvoteFeedback(post.id)}
                                  className="flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-slate-300 font-bold transition-all"
                                >
                                  👍 Upvote <span className="text-indigo-400 bg-white/5 px-1.5 py-0.5 rounded ml-1 font-extrabold">{post.votes}</span>
                                </button>

                                {/* Faculty specific override action buttons */}
                                {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '') && (
                                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] font-black uppercase">
                                    <button 
                                      onClick={() => handleFacultyStatusUpdate(post.id, 'in-progress')}
                                      className="p-1 px-2 border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 rounded"
                                    >
                                      Mark Progress
                                    </button>
                                    <button 
                                      onClick={() => handleFacultyStatusUpdate(post.id, 'solved')}
                                      className="p-1 px-2 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 rounded"
                                    >
                                      Mark Addressed/Solved
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Nested comments reply stream */}
                              {post.replies.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-white/5 bg-black/30 p-3.5 rounded-xl border border-white/5">
                                  <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Faculty Feedback</p>
                                  {post.replies.map((rep, idx) => (
                                    <div key={idx} className="space-y-0.5 leading-relaxed text-[11px]">
                                      <p className="font-extrabold text-white">{rep.author} <span className="font-mono text-slate-500 text-[9px]">({rep.role})</span></p>
                                      <p className="text-slate-300">{rep.text}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Tab 7: AI Teacher Chat Dialog */}
              {activeTab === 'ai_teacher' && (
                <div className="h-[calc(100dvh-130px)] flex flex-col smart-glass p-3 sm:p-4 rounded-3xl border border-white/10 shadow-xl relative w-full overflow-hidden animate-fadeIn">
                  
                  {/* Slide-out Study Threads Drawer */}
                  <AnimatePresence>
                    {showAiHistoryDrawer && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setShowAiHistoryDrawer(false)}
                          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 transition-opacity"
                        />
                        <motion.div
                          initial={{ x: '-100%' }}
                          animate={{ x: 0 }}
                          exit={{ x: '-100%' }}
                          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                          className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-slate-950/95 border-r border-white/10 z-50 p-5 flex flex-col shadow-2xl backdrop-blur-md"
                        >
                          <div className="flex items-center justify-between pb-4 border-b border-white/10">
                            <div className="flex items-center gap-2">
                              <History className="w-4 h-4 text-indigo-400" />
                              <h3 className="font-extrabold text-sm text-white">Study Threads</h3>
                            </div>
                            <button
                              onClick={() => setShowAiHistoryDrawer(false)}
                              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="pt-3 pb-2">
                            <button
                              onClick={() => {
                                handleCreateNewThread();
                                setShowAiHistoryDrawer(false);
                              }}
                              className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>New Study Session</span>
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1">
                            {aiThreads.length === 0 ? (
                              <p className="text-center text-slate-500 text-xs py-8">No previous study threads</p>
                            ) : (
                              aiThreads.map(t => (
                                <div
                                  key={t.id}
                                  onMouseDown={(e) => {
                                    const x = e.clientX;
                                    const y = e.clientY;
                                    holdTimerRef.current = setTimeout(() => {
                                      setAiThreadHoldMenu({ threadId: t.id, x, y });
                                    }, 1000);
                                  }}
                                  onMouseUp={() => clearTimeout(holdTimerRef.current)}
                                  onMouseLeave={() => clearTimeout(holdTimerRef.current)}
                                  onTouchStart={(e) => {
                                    const x = e.touches[0].clientX;
                                    const y = e.touches[0].clientY;
                                    holdTimerRef.current = setTimeout(() => {
                                      setAiThreadHoldMenu({ threadId: t.id, x, y });
                                    }, 1000);
                                  }}
                                  onTouchEnd={() => clearTimeout(holdTimerRef.current)}
                                  onClick={() => {
                                    setActiveThreadId(t.id);
                                    setSelectedPersona(t.personaId);
                                    setAiMode(t.mode);
                                    if (t.attachedFiles) {
                                      setAttachedFiles(t.attachedFiles);
                                    } else if (t.attachedFile) {
                                      setAttachedFiles([t.attachedFile]);
                                    } else {
                                      setAttachedFiles([]);
                                    }
                                    setShowAiHistoryDrawer(false);
                                  }}
                                  className={`group flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all relative ${
                                    activeThreadId === t.id
                                      ? 'border-indigo-500 bg-indigo-500/15 shadow-sm'
                                      : 'border-white/5 bg-slate-900/40 hover:bg-slate-900 hover:border-white/10'
                                  }`}
                                >
                                  {t.isPinned && <Pin className="w-2.5 h-2.5 text-amber-400 absolute -top-1 -right-1 rotate-45" />}
                                  <div className="flex items-center gap-2.5 truncate max-w-[82%]">
                                    <span className="text-sm shrink-0">
                                      {AI_PERSONAS.find(p => p.id === t.personaId)?.avatarChar || '💬'}
                                    </span>
                                    <div className="truncate">
                                      <span className="text-xs text-slate-200 truncate font-semibold block leading-tight">{t.title}</span>
                                      <span className="text-[9px] text-slate-400 capitalize">{t.mode}</span>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>

                  {/* Header: Controls, Selectors & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5 shrink-0">
                    {/* Left Actions: History Drawer & New Thread */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-white font-black text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Byte</span>
                        <span className="text-[9px] uppercase font-mono px-1 rounded bg-white/10 text-indigo-300">
                          {effectiveRole || 'student'}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowAiHistoryDrawer(true)}
                        className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-850 border border-white/10 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm active:scale-95"
                        title="Open Study History & Threads"
                      >
                        <History className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="hidden sm:inline">Threads</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                          {aiThreads.length}
                        </span>
                      </button>
                      <button
                        onClick={handleCreateNewThread}
                        className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 text-xs font-bold transition-all shadow-sm active:scale-95"
                        title="Start New Thread"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">New</span>
                      </button>
                      <button
                        onClick={() => setIsJarvisActive(true)}
                        className="px-2 py-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white flex items-center gap-1 text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                        title="Open Orion AI Copilot"
                      >
                        <Sparkles className="w-3 h-3 text-cyan-300 animate-pulse" />
                        <span className="hidden sm:inline">Orion</span>
                      </button>
                    </div>

                    {/* Center Selectors: Tutor Persona & Tutorial Mode */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Persona Selector */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-xl px-2 py-1 shadow-inner">
                        <span className="text-xs shrink-0">
                          {AI_PERSONAS.find(p => p.id === selectedPersona)?.avatarChar || '🤖'}
                        </span>
                        <select
                          value={selectedPersona}
                          onChange={(e) => handleSwitchPersona(e.target.value)}
                          className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-1 max-w-[120px] sm:max-w-[160px] truncate"
                          title="Select AI Instructor"
                        >
                          {AI_PERSONAS.map(p => (
                            <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                              {p.name} ({p.speciality})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Mode Selector */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-xl px-2 py-1 shadow-inner">
                        <select
                          value={aiMode}
                          onChange={(e) => handleSwitchMode(e.target.value as any)}
                          className="bg-transparent text-indigo-300 text-xs font-bold focus:outline-none cursor-pointer uppercase tracking-wider text-[10px] max-w-[100px] sm:max-w-none"
                          title="Active Tutorial Mode"
                        >
                          <option value="explanatory" className="bg-slate-900 text-white">📚 Explainer Mode</option>
                          <option value="socratic" className="bg-slate-900 text-white">🎓 Socratic Mode</option>
                          <option value="coder" className="bg-slate-900 text-white">💻 Coding Coach</option>
                          <option value="quiz_gen" className="bg-slate-900 text-white">📝 Quiz Exam</option>
                        </select>
                      </div>

                      {/* Reasoning Mode Toggle */}
                      <button
                        type="button"
                        onClick={() => setAiReasoningMode(!aiReasoningMode)}
                        className={`px-2 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          aiReasoningMode ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-sm' : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                        }`}
                        title="Toggle Deep Reasoning Mode"
                      >
                        <Cpu className="w-3 h-3 text-purple-400" />
                        <span className="hidden sm:inline">{aiReasoningMode ? 'Reasoning: ON' : 'Reasoning'}</span>
                      </button>

                      {/* Web Search Mode Selector */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-teal-500/25 rounded-xl px-2 py-1 shadow-inner">
                        <Globe className={`w-3 h-3 shrink-0 ${aiWebSearchMode === 'off' ? 'text-slate-500' : 'text-teal-400'}`} />
                        <select
                          value={aiWebSearchMode}
                          onChange={(e) => setAiWebSearchMode(e.target.value as 'auto' | 'force' | 'off')}
                          className="bg-transparent text-teal-300 text-[10px] font-bold focus:outline-none cursor-pointer uppercase tracking-wider"
                          title="Web Search Mode"
                        >
                          <option value="auto" className="bg-slate-900 text-white">🌐 Auto</option>
                          <option value="force" className="bg-slate-900 text-white">🔍 Search</option>
                          <option value="off" className="bg-slate-900 text-white">⚡ Fast</option>
                        </select>
                      </div>

                      {/* Super Admin Model Provider Switcher */}
                      {(currentUser?.role === 'super_admin' || effectiveRole === 'super_admin') && (
                        <div className="flex items-center gap-1 bg-slate-900 border border-purple-500/35 rounded-xl px-2 py-1 shadow-inner">
                          <Cpu className="w-3 h-3 text-purple-400 shrink-0" />
                          <select
                            value={aiModelOverride || 'auto'}
                            onChange={(e) => setAiModelOverride(e.target.value === 'auto' ? '' : e.target.value)}
                            className="bg-transparent text-purple-300 text-[10px] font-bold focus:outline-none cursor-pointer uppercase tracking-wider"
                            title="Super Admin Model Override"
                          >
                            <option value="auto" className="bg-slate-900 text-white">🤖 Auto</option>
                            <option value="apinex" className="bg-slate-900 text-white">⚡ APInex</option>
                            <option value="ministral" className="bg-slate-900 text-white">🌊 Ministral</option>
                            <option value="groq" className="bg-slate-900 text-white">🚀 Groq</option>
                            <option value="nara_router" className="bg-slate-900 text-white">🎯 Nara</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Right: Integrated Quota Badge & Clear Chat */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-900/90 border border-white/10 text-xs">
                        <div className="flex items-center gap-0.5 font-mono text-[11px] font-bold">
                          <span className={aiUsageState.remaining <= 0 ? 'text-rose-400' : 'text-emerald-400'}>
                            {aiUsageState.remaining}
                          </span>
                          <span className="text-slate-400 font-sans text-[10px]">/{aiUsageState.limit}</span>
                        </div>
                        <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden md:block">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              aiUsageState.remaining <= 0
                                ? 'bg-rose-500'
                                : (aiUsageState.used / Math.max(1, aiUsageState.limit)) > 0.8
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.round((aiUsageState.used / Math.max(1, aiUsageState.limit)) * 100))}%` }}
                          />
                        </div>
                        <button
                          onClick={() => setShowQuotaModal(true)}
                          className="px-1.5 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-white font-extrabold text-[9px] uppercase tracking-wider transition-all flex items-center gap-0.5"
                          title="Upgrade or Boost Quota"
                        >
                          <Zap className="w-2.5 h-2.5" /> Boost
                        </button>
                      </div>

                      <button
                        onClick={handleClearThreadHistory}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition-all"
                        title="Clear dialogue entries for this thread"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Dialogue Stream Body */}
                  <div id="ai-dialog-scroll" className="flex-1 min-h-0 overflow-y-auto pr-2 my-2.5 space-y-3.5 bg-slate-950/40 p-3 sm:p-4 rounded-2xl border border-white/5 shadow-inner">
                      <div className="text-center p-2.5 border border-white/5 bg-white/5 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-left">
                          <p className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                            <span>🤖</span> Byte AI Workspace — Unified Assistant & Teacher
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Ask questions, debug equations, or ask Byte to teach any topic interactively.</p>
                        </div>
                        <button
                          onClick={() => {
                            const topicPrompt = prompt('Enter any concept or topic to launch an interactive Byte lesson:', 'Quantum Computing');
                            if (topicPrompt && topicPrompt.trim()) {
                              setSelectedTopicForTutor(topicPrompt.trim());
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                          title="Launch interactive teaching session on any topic"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Teach Me Anything</span>
                        </button>
                      </div>

                      {(!activeThread || !activeThread.messages || activeThread.messages.length === 0) && (
                        <div className="py-6 px-4 space-y-6 text-center animate-fadeIn">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="p-3 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400">
                              <Sparkles className="w-8 h-8 animate-pulse" />
                            </div>
                            <h3 className="text-base font-black text-white tracking-tight mt-2">
                              Hi, {currentUser?.name || 'Scholar'}! I am Byte 👋
                            </h3>
                            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                              Your unified AI assistant for conversational research, homework derivations, and interactive teaching. Ask me anything, or tap a topic to launch an interactive lesson:
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left">
                            {[
                              { icon: '🌌', label: 'Quantum Physics', text: 'Teach me Quantum Physics with analogies and an interactive quiz.' },
                              { icon: '🧪', label: 'Chemistry', text: 'Teach me how to balance chemical equations with worked examples.' },
                              { icon: '📈', label: 'Calculus', text: 'Explain the derivative product rule step by step.' },
                              { icon: '💻', label: 'Computer Networks', text: 'Teach me Network Topologies and Protocols for exams.' }
                            ].map((item, i) => (
                              <button
                                key={i}
                                onClick={() => handleAskAIModel(item.text)}
                                className="p-3.5 bg-slate-900 hover:bg-slate-850 border border-white/5 hover:border-indigo-500/40 rounded-2xl transition-all group flex flex-col justify-between h-28 text-left hover:scale-[1.02] active:scale-95 cursor-pointer shadow-sm"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-lg">{item.icon}</span>
                                  <span className="text-[8px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded font-extrabold uppercase tracking-widest border border-indigo-500/20">{item.label}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-2 group-hover:text-white transition-colors line-clamp-2">
                                  "{item.text}"
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeThread && (activeThread.messages || []).map((m, idx) => {
                        const msgKey = `${activeThread.id}-${idx}`;
                        const isSpeaking = speakingMsgIdx === msgKey;
                        const prevUserMsg = idx > 0 && activeThread.messages[idx - 1]?.role === 'user' ? activeThread.messages[idx - 1].content : '';
                        const mathWidget = m.role === 'assistant' ? detectMathInteractiveWidget(prevUserMsg, m.content) : null;
                        const isLatestAssistant = m.role === 'assistant' && idx === (activeThread.messages.length - 1);

                        return (
                          <div key={idx} className={`p-3.5 rounded-2xl text-xs max-w-[92%] sm:max-w-[85%] overflow-hidden ${m.role === 'user' ? 'bg-indigo-600/15 border border-indigo-500/20 text-white ml-auto' : 'bg-slate-900 border border-white/5 text-slate-200 mr-auto'}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-indigo-400">
                                {m.role === 'user' ? `👤 ${currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Student'} Inquiry` : '🤖 Byte'}
                              </span>
                              {m.role === 'assistant' && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {m.webSearchUsed && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-teal-500/15 border border-teal-500/30 text-teal-300 font-mono font-bold flex items-center gap-1">
                                      🌐 Web Grounded {m.webSources?.length ? `(${m.webSources.length})` : ''}
                                    </span>
                                  )}
                                  {isLatestAssistant && aiGroundedInData && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold">
                                      ✓ StudentOS Live Data
                                    </span>
                                  )}
                                  {isLatestAssistant && aiActiveModelLabel && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono">
                                      ⚡ {aiActiveModelLabel === 'combo/free' ? 'combo/free' : aiActiveModelLabel.split('/').pop()}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1 overflow-x-auto">
                              {renderMarkdown(m.content)}
                              {m.role === 'assistant' && isLatestAssistant && aiLoading && (
                                <span className="inline-block w-2 h-3.5 ml-1 bg-indigo-400 animate-pulse rounded-sm align-middle" title="Generating..." />
                              )}
                            </div>

                            {/* Interactive Math / Geometry Visualization when relevant */}
                            {mathWidget && (
                              <InteractiveMathWidget widgetType={mathWidget} />
                            )}

                            {/* Byte Dynamic Topic Interactive Lesson Card Trigger */}
                            {(() => {
                              const detectedTopic = extractTopicTeachingIntent(prevUserMsg) || (m.role === 'assistant' && extractTopicTeachingIntent(m.content));
                              if (detectedTopic && m.role === 'assistant') {
                                return (
                                  <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-purple-950/50 to-slate-900 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                                    <div className="flex items-center gap-2.5">
                                      <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                                        <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                                      </div>
                                      <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                                          <span>🤖</span> Byte Interactive Classroom
                                        </span>
                                        <p className="text-xs font-bold text-white mt-0.5">Master "{detectedTopic}" with animated Byte tutor & checkpoint quiz</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => setSelectedTopicForTutor(detectedTopic)}
                                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                                    >
                                      <span>🚀 Launch Interactive Lesson</span>
                                    </button>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* Verified Web Search Sources & Citations Panel */}
                            {m.role === 'assistant' && m.webSources && m.webSources.length > 0 && (
                              <div className="mt-3 pt-2.5 border-t border-teal-500/20 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-teal-400 font-extrabold flex items-center gap-1">
                                    <Globe className="w-3 h-3" /> Verified Web & Academic Sources ({m.webSources.length})
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {m.webSources.map((src, sIdx) => (
                                    <a
                                      key={sIdx}
                                      href={src.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="group flex items-start gap-2 p-2 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-white/5 hover:border-teal-500/40 transition-all text-left"
                                    >
                                      <span className="px-1.5 py-0.5 rounded bg-teal-500/15 border border-teal-500/30 text-teal-300 font-mono text-[9px] font-bold shrink-0">
                                        [{sIdx + 1}]
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[10px] font-bold text-slate-200 group-hover:text-teal-300 truncate">
                                          {src.title}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-[8px] font-mono text-slate-400 truncate">{src.domain}</span>
                                          {src.sourceType === 'academic' && (
                                            <span className="text-[7px] uppercase px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                                              Academic
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Attached Files visual inside bubbles */}
                            {m.files && m.files.length > 0 && (
                              <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2 bg-black/10 -mx-3.5 px-3.5 py-2.5 rounded-b-2xl">
                                <p className="text-[8px] text-indigo-400 uppercase font-black tracking-wider leading-none mb-1">Attached References:</p>
                                <div className="flex flex-col gap-1.5">
                                  {m.files.map((file: any, fIdx: number) => {
                                    let icon = '📎';
                                    let colorTheme = 'border-indigo-500/10 bg-indigo-950/10';
                                    if (file.name.toLowerCase().endsWith('.pdf')) {
                                      icon = '📕';
                                      colorTheme = 'border-red-500/10 bg-red-950/10';
                                    } else if (file.type.startsWith('image/')) {
                                      icon = '🖼️';
                                      colorTheme = 'border-emerald-500/10 bg-emerald-950/10';
                                    } else if (file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) {
                                      icon = '📘';
                                      colorTheme = 'border-blue-500/10 bg-blue-950/10';
                                    } else if (file.name.toLowerCase().endsWith('.ppt') || file.name.toLowerCase().endsWith('.pptx')) {
                                      icon = '📊';
                                      colorTheme = 'border-amber-500/10 bg-amber-950/10';
                                    } else if (file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.txt')) {
                                      icon = '📝';
                                      colorTheme = 'border-indigo-500/10 bg-indigo-950/10';
                                    }

                                    const extSize = (file.size / (1024 * 1024)).toFixed(2);
                                    const showMb = Number(extSize) > 0.1 ? `${extSize} MB` : `${(file.size / 1024).toFixed(1)} KB`;

                                    return (
                                      <div key={fIdx} className={`flex items-center justify-between p-2 rounded-xl border ${colorTheme} text-[10px]`}>
                                        <div className="flex items-center gap-2 truncate">
                                          <span className="text-sm shrink-0">{icon}</span>
                                          <div className="truncate text-left leading-tight">
                                            <p className="font-extrabold text-white truncate max-w-[150px]">{file.name}</p>
                                            <p className="text-[8px] text-slate-400 font-mono">{showMb}</p>
                                          </div>
                                        </div>
                                        {file.type.startsWith('image/') && file.content && (
                                          <div className="w-8 h-8 rounded overflow-hidden border border-white/5 shrink-0 bg-black/40">
                                            <img src={file.content} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {m.role !== 'user' && m.content && (
                              <div className="mt-3 pt-2 border-t border-white/5 space-y-2">
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                  <button
                                    onClick={() => handleCopyToClipboard(m.content)}
                                    className="flex items-center gap-1 hover:text-white hover:bg-white/10 bg-slate-950/40 border border-white/5 px-2.5 py-1 rounded-lg transition-colors font-medium active:scale-95"
                                    title="Copy text content to clipboard"
                                  >
                                    <span>📋</span> Copy
                                  </button>
                                  <button
                                    onClick={() => handleSaveToNotes(m.content)}
                                    className="flex items-center gap-1 hover:text-white hover:bg-white/10 bg-slate-950/40 border border-white/5 px-2.5 py-1 rounded-lg transition-colors font-medium active:scale-95"
                                    title="Save to Personal Vault Notes"
                                  >
                                    <span>💾</span> Save Note
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const res = await saveStudyOutputToFlashcards(
                                        activeThread.title || 'AI Study Deck',
                                        currentUser?.specialtySubject || 'General Studies',
                                        m.content,
                                        currentUser?.uid || 'guest'
                                      );
                                      showNotification(`✓ Created Flashcard Deck (${res.count} cards) in Flashcards Engine!`);
                                    }}
                                    className="flex items-center gap-1 hover:text-white hover:bg-indigo-500/20 bg-slate-950/40 border border-white/5 px-2.5 py-1 rounded-lg transition-colors font-medium active:scale-95"
                                    title="Convert this explanation into interactive Flashcards"
                                  >
                                    <span>🗂️</span> Save Flashcards
                                  </button>
                                  <button
                                    onClick={() => handleToggleSpeakMessage(m.content, msgKey)}
                                    className={`flex items-center gap-1 border px-2.5 py-1 rounded-lg transition-colors font-medium active:scale-95 ${isSpeaking ? 'text-rose-400 border-rose-500/30 bg-rose-500/10 font-bold' : 'hover:text-white hover:bg-white/10 bg-slate-950/40 border-white/5'}`}
                                    title={isSpeaking ? "Suspend voice generator output" : "Synthesize study reading"}
                                  >
                                    <span>{isSpeaking ? '⏹️' : '🔊'}</span> {isSpeaking ? 'Stop' : 'Read Aloud'}
                                  </button>
                                  {prevUserMsg && !aiLoading && (
                                    <button
                                      onClick={() => handleAskAIModel(prevUserMsg)}
                                      className="flex items-center gap-1 hover:text-white hover:bg-amber-500/20 bg-slate-950/40 border border-white/5 px-2.5 py-1 rounded-lg transition-colors font-medium active:scale-95"
                                      title="Regenerate or retry this response"
                                    >
                                      <span>🔄</span> {m.content.includes('temporarily unavailable') ? 'Retry' : 'Regenerate'}
                                    </button>
                                  )}
                                </div>

                                {/* 1-Click Follow-Up Pedagogical Controls on Latest Message */}
                                {isLatestAssistant && !aiLoading && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    {[
                                      { label: '✨ Explain Simply', prompt: 'Explain the previous concept more simply for a beginner with an intuitive analogy.' },
                                      { label: '🪜 Step-by-Step', prompt: 'Break this down into numbered step-by-step derivations and explain why each step works.' },
                                      { label: '💡 Give Examples', prompt: 'Give 2 worked real-world and exam-style examples of this topic.' },
                                      { label: '📝 Quiz Me (5 Qs)', prompt: 'Generate a 5-question interactive practice quiz on this topic with answers and explanations at the end.' },
                                      { label: '🗂️ Make Flashcards', prompt: 'Create 6 structured Q: / A: flashcards covering the most important definitions and formulas from this topic.' },
                                      { label: '📌 Quick Summary', prompt: 'Give me a crisp bulleted revision cheat-sheet of the key takeaways and formulas.' }
                                    ].map((actionChip, cIdx) => (
                                      <button
                                        key={cIdx}
                                        onClick={() => handleAskAIModel(actionChip.prompt)}
                                        className="px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-[10px] font-semibold text-indigo-300 transition-all cursor-pointer active:scale-95"
                                      >
                                        {actionChip.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {aiLoading && (
                        <div className="p-3.5 bg-indigo-950/40 text-indigo-300 border border-indigo-500/30 rounded-2xl text-xs max-w-[85%] mr-auto flex items-center justify-between gap-3 shadow-md animate-fadeIn">
                          <div className="flex items-center gap-3">
                            <div className="relative flex items-center justify-center shrink-0">
                              <div className="w-3.5 h-3.5 rounded-full bg-indigo-400 animate-ping absolute opacity-75" />
                              <div className="w-3 h-3 rounded-full bg-indigo-500 relative flex items-center justify-center text-[8px] text-white font-bold">🤖</div>
                            </div>
                            <div>
                              <span className="font-extrabold text-white text-[11px] block">Byte is thinking & generating...</span>
                              <span className="text-[10px] text-indigo-300/80 font-mono">
                                {aiStatusMessage || (aiReasoningMode ? 'Evaluating multi-step reasoning chain...' : 'Analyzing query & synthesizing clear explanation...')}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => aiAbortControllerRef.current?.abort()}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-bold text-[10px] shrink-0 cursor-pointer transition-all active:scale-95"
                          >
                            ⏹ Stop
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Chat Interactive Composer with Integrated File Upload */}
                    <div className="shrink-0 space-y-2 pt-1">
                      
                      {/* Attached Files Chips Strip */}
                      {attachedFiles && attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 bg-slate-900/60 rounded-xl border border-white/5 max-h-[100px] overflow-y-auto">
                          {attachedFiles.map((file, idx) => {
                            let icon = '📎';
                            if (file.name.toLowerCase().endsWith('.pdf')) icon = '📕';
                            else if (file.type.startsWith('image/')) icon = '🖼️';
                            else if (file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) icon = '📘';
                            else if (file.name.toLowerCase().endsWith('.ppt') || file.name.toLowerCase().endsWith('.pptx')) icon = '📊';
                            else if (file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.txt')) icon = '📝';
                            
                            const kbSize = (file.size / 1024).toFixed(1);

                            return (
                              <div key={idx} className="flex items-center gap-1.5 bg-indigo-950/40 text-[10px] text-indigo-300 px-2.5 py-1 rounded-xl border border-indigo-500/20 shadow-sm transition-all hover:border-indigo-500/40">
                                <span>{icon}</span>
                                <span className="truncate max-w-[130px] font-semibold">{file.name}</span>
                                <span className="text-[8px] text-slate-500 font-mono">({kbSize} KB)</span>
                                <button 
                                  type="button"
                                  onClick={() => handleRemoveAttachedFile(file.name)} 
                                  className="text-slate-400 hover:text-red-400 font-extrabold cursor-pointer ml-1 p-0.5 rounded hover:bg-white/5 active:scale-90 leading-none"
                                  title="Remove attachment"
                                >
                                  <X className="w-3 h-3 inline" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Hidden File Input Triggered by Composer Paperclip */}
                      <input 
                        type="file" 
                        ref={aiFileInputRef}
                        id="ai-file-uploader"
                        onChange={handleFileUploadAction}
                        multiple
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
                        className="hidden"
                      />

                      {/* Limit exhaustion alert banner */}
                      {aiUsageState.remaining <= 0 && (
                        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-center justify-between gap-3 animate-fadeIn">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                            <span className="font-medium text-[11px]">
                              Daily AI query quota exhausted (0/{aiUsageState.limit} remaining). Next slot unlocks in ~{aiUsageState.nextAvailableInMinutes || 60}m.
                            </span>
                          </div>
                          <button
                            onClick={() => setShowQuotaModal(true)}
                            className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-[10px] uppercase tracking-wider transition-all shrink-0 flex items-center gap-1 shadow-sm active:scale-95"
                          >
                            <Zap className="w-3 h-3" /> Upgrade
                          </button>
                        </div>
                      )}

                      {/* Composer input bar */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            (window as any).__studentos_file_picker_active__ = true;
                            aiFileInputRef.current?.click();
                          }}
                          className="p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-white/10 text-slate-400 hover:text-indigo-400 transition-all shrink-0 active:scale-95"
                          title="Attach study files (PDF, DOC, DOCX, PPT, PPTX, Images, Notes)"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <input 
                          type="text"
                          value={aiInput}
                          onChange={e => setAiInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAskAIModel()}
                          placeholder={
                            aiUsageState.remaining <= 0 
                              ? "Daily quota exhausted. Click 'Upgrade Quota' above to redeem code or boost limit." 
                              : attachedFiles && attachedFiles.length > 0 
                                ? `Ask Mentor about ${attachedFiles.map(f => f.name).join(', ')}...` 
                                : "Ask about formulas, essay analysis, code bugs, exam revision..."
                          }
                          disabled={aiLoading || aiUsageState.remaining <= 0}
                          className={`flex-1 px-4 py-3 rounded-xl bg-slate-900 border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white font-medium ${aiUsageState.remaining <= 0 ? 'border-red-500/30 opacity-70 cursor-not-allowed' : 'border-white/10'}`}
                        />
                        <button 
                          onClick={aiUsageState.remaining <= 0 ? () => setShowQuotaModal(true) : () => handleAskAIModel()}
                          disabled={aiLoading}
                          className={`px-4 sm:px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 shrink-0 ${
                            aiUsageState.remaining <= 0 
                              ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        >
                          {aiUsageState.remaining <= 0 ? (
                            <><Zap className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Boost</span></>
                          ) : (
                            <><Send className="w-3.5 h-3.5" /> <span className="hidden sm:inline">AskAI</span></>
                          )}
                        </button>
                      </div>
                    </div>
                </div>
              )}

              {/* Tab 8: Peer global chat matrix */}
              <ChatSystem
                key={currentUser?.uid || currentUser?.email || 'chat'}
                currentUser={currentUser}
                effectiveRole={effectiveRole as any}
                chatRooms={chatRooms}
                setChatRooms={setChatRooms}
                chats={chats}
                setChats={setChats}
                activeChatTargetId={activeChatTargetId}
                setActiveChatTargetId={setActiveChatTargetId}
                showNotification={showNotification}
                students={students}
                activeTab={activeTab}
              />

              {/* Tab 9: Faculty Center — Teacher Interface */}
              {activeTab === 'faculty' && effectiveRole === 'teacher' && (() => {
                const assignedGradesList = currentUser.assignedGrades && currentUser.assignedGrades.length > 0
                  ? currentUser.assignedGrades
                  : [currentUser.grade || 'Grade 10'];
                const assignedSectionsList = currentUser.assignedSections && currentUser.assignedSections.length > 0
                  ? currentUser.assignedSections
                  : [currentUser.section || 'Solara'];
                const teacherHomework = homeworkList.filter(hw =>
                  assignedGradesList.includes(hw.classGrade) || hw.givenBy === currentUser.name
                );
                const pendingSubmissionsToReview = teacherHomework.reduce(
                  (acc, hw) => acc + (hw.completedList ? hw.completedList.length : 0),
                  0
                );

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-6 max-w-6xl mx-auto pb-12"
                  >
                    {/* Header: Faculty Center Title, Contextual Greeting & Academic Context */}
                    <div className="bento-card rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
                      <BorderBeam size={220} duration={12} colorFrom="#6366f1" colorTo="#a855f7" />
                      <div className="space-y-2 relative z-10">
                        <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold flex-wrap">
                          <span>Faculty Center</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-300">{currentUser.department || currentUser.specialtySubject || 'Academic Faculty'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400 font-mono">Term 1 Academic Period</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">
                          <SplitTextReveal text={`Good day, ${currentUser.name}`} />
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                          Overview of your assigned classes ({assignedGradesList.join(', ')} · {assignedSectionsList.join(', ')}), pending assignment reviews, upcoming lessons, and gradebook records.
                        </p>
                      </div>

                      {/* Primary Quick Actions */}
                      <div className="flex flex-wrap items-center gap-2.5 shrink-0 relative z-10">
                        <ShimmerButton
                          onClick={() => {
                            soundService.playButtonClick();
                            handleTabSelect('whiteboard');
                          }}
                          className="px-4 py-2 text-xs font-bold"
                        >
                          <Monitor className="w-4 h-4" />
                          <span>Open Smartboard Class</span>
                        </ShimmerButton>
                        <button
                          type="button"
                          onClick={() => {
                            soundService.playButtonClick();
                            handleTabSelect('attendance_manager');
                          }}
                          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Take Attendance
                        </button>
                      </div>
                    </div>

                    {/* Quick Actions Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: 'Open Classes', icon: '🏫', action: () => { setProfileTab('student_list'); handleTabSelect('profile'); } },
                        { label: 'Manage Assignments', icon: '📓', action: () => handleTabSelect('homework') },
                        { label: 'Review Submissions', icon: '📋', action: () => handleTabSelect('assignments') },
                        { label: 'Open Gradebook', icon: '📊', action: () => handleTabSelect('gradebook') },
                        { label: 'School Calendar', icon: '📅', action: () => handleTabSelect('calendar') },
                        { label: 'Teaching Materials', icon: '📂', action: () => handleTabSelect('materials') }
                      ].map((item) => (
                        <CardSpotlight
                          key={item.label}
                          onClick={() => {
                            soundService.playButtonClick();
                            item.action();
                          }}
                          className="p-4 rounded-2xl flex flex-col items-start justify-between gap-2 text-left cursor-pointer group"
                        >
                          <span className="text-xl">{item.icon}</span>
                          <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors whitespace-nowrap">
                            {item.label}
                          </span>
                        </CardSpotlight>
                      ))}
                    </div>

                    {/* Priority Overview Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left 7 Cols: Assigned Classes & Pending Assignment Reviews */}
                      <div className="lg:col-span-7 space-y-6">
                        {/* Assigned Classes & Sections */}
                        <div className="bento-card rounded-3xl p-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                            <div>
                              <h2 className="text-base font-bold text-white">Assigned Classes & Sections</h2>
                              <p className="text-xs text-slate-400">Authorized cohorts under your instruction</p>
                            </div>
                            <span className="text-xs font-mono text-indigo-400 tabular-nums">
                              {assignedGradesList.length} {assignedGradesList.length === 1 ? 'Grade' : 'Grades'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {assignedGradesList.map((grade) => (
                              <div key={grade} className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-bold text-white">{grade}</p>
                                  <p className="text-xs text-slate-400">
                                    Sections: {assignedSectionsList.join(', ')} · {currentUser.specialtySubject || 'Core Subject'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleTabSelect('attendance_manager')}
                                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-indigo-600 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
                                >
                                  Roll Call
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Pending Grading & Assignment Review Tasks */}
                        <div className="bento-card rounded-3xl p-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                            <div>
                              <h2 className="text-base font-bold text-white">Assignment & Submission Review</h2>
                              <p className="text-xs text-slate-400">Active homework assigned to your classes</p>
                            </div>
                            <span className="text-xs font-mono text-emerald-400 tabular-nums">
                              {pendingSubmissionsToReview} student submissions
                            </span>
                          </div>

                          {teacherHomework.length === 0 ? (
                            <div className="py-6 text-center space-y-2">
                              <p className="text-sm font-semibold text-slate-200">No active assignments awaiting review</p>
                              <p className="text-xs text-slate-400">
                                Create a new homework task or assessment sheet from the Homework Hub.
                              </p>
                            </div>
                          ) : (
                            <div className="divide-y divide-white/5">
                              {teacherHomework.slice(0, 5).map((hw) => (
                                <div key={hw.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                      <span className="font-semibold text-indigo-400">{hw.subject}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{hw.classGrade} ({hw.classSection || 'All Sections'})</span>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono">Due {hw.dueDate}</span>
                                    </div>
                                    <p className="text-sm font-bold text-white truncate mt-0.5">{hw.title}</p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs font-mono text-emerald-400 tabular-nums">
                                      {(hw.completedList || []).length} completed
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleTabSelect('homework')}
                                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                                    >
                                      Review →
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right 5 Cols: Upcoming Lessons & School Announcements */}
                      <div className="lg:col-span-5 space-y-6">
                        {/* Upcoming Lessons */}
                        <div className="bento-card rounded-3xl p-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                            <h2 className="text-base font-bold text-white">Upcoming Lessons & Schedule</h2>
                            <button
                              type="button"
                              onClick={() => handleTabSelect('calendar')}
                              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                            >
                              Full Calendar →
                            </button>
                          </div>

                          {schedules.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">No scheduled lecture blocks today.</p>
                          ) : (
                            <div className="space-y-2.5">
                              {schedules.slice(0, 4).map((sch) => (
                                <div key={sch.id} className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs sm:text-sm font-bold text-white">{sch.subject}</p>
                                    <p className="text-[11px] text-slate-400">{sch.day}</p>
                                  </div>
                                  <span className="text-xs font-mono text-indigo-300 tabular-nums">{sch.time}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Relevant School Announcements */}
                        <div className="bento-card rounded-3xl p-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                            <h2 className="text-base font-bold text-white">Faculty & School Notices</h2>
                            <span className="text-xs text-slate-400">{announcements.length} active</span>
                          </div>

                          {announcements.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">No recent faculty announcements.</p>
                          ) : (
                            <div className="space-y-3">
                              {announcements.slice(0, 3).map((ann) => (
                                <div key={ann.id} className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span className="font-semibold text-indigo-300">{ann.tag || 'Notice'}</span>
                                    <span className="font-mono">{ann.date || 'Today'}</span>
                                  </div>
                                  <h3 className="text-xs sm:text-sm font-bold text-white">{ann.title}</h3>
                                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{ann.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Integrated Student Marks & Evaluation Center */}
                    <StudentMarksCenter currentUser={currentUser} effectiveRole={effectiveRole} showNotification={showNotification} />
                  </motion.div>
                );
              })()}

              {/* Tab 10: Attendance Manager */}
              {activeTab === 'attendance_manager' && ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole) && (
                <AttendanceManager currentUser={currentUser} effectiveRole={effectiveRole} />
              )}

              {/* Tab 11: Admin Center */}
              {activeTab === 'admin' && (effectiveRole === 'admin' || effectiveRole === 'super_admin') && (
                <AdminCenter currentUser={currentUser} showNotification={showNotification} />
              )}

              {/* Tab 12: StudentOS Life Community Hub */}
              {(activeTab === 'life' || activeTab === 'studentos_life') && (
                <StudentOSLife
                  currentUser={
                    currentUser
                      ? { ...currentUser, role: (effectiveRole || currentUser.role) as UserRole }
                      : {
                          uid: 'guest',
                          name: 'Guest Student',
                          email: 'guest@studentos.internal',
                          role: 'student',
                          house: 'Emerald',
                          section: 'Solara',
                          grade: 'Grade 10',
                          streakDays: 5,
                          quizzesTaken: 3,
                          studyHours: 12
                        }
                  }
                  onNavigateToTab={handleTabSelect}
                  onTriggerOrionAction={() => setIsJarvisActive(true)}
                />
              )}

              {/* Tab 13: Teacher Fun Zone */}
              {(activeTab === 'funzone' || activeTab === 'teacher_fun_zone') && (
                <TeacherFunZone currentUser={currentUser || {
                  uid: 'guest',
                  name: 'Guest Teacher',
                  email: 'teacher@studentos.internal',
                  role: 'teacher',
                  house: 'Ruby',
                  section: 'Astra',
                  grade: 'Grade 12',
                  streakDays: 10,
                  quizzesTaken: 12,
                  studyHours: 40
                }} />
              )}

              {/* Tab 14: Academic Calendar */}
              {activeTab === 'calendar' && (
                <AcademicCalendar currentUser={currentUser} effectiveRole={effectiveRole} />
              )}

              {/* Tab 15: What's New & Official Release Logs */}
              {(activeTab === 'whats_new' || activeTab === 'whats-new') && (
                <WhatsNewPortal
                  currentUser={currentUser}
                  effectiveRole={effectiveRole}
                  onNavigateTab={handleTabSelect}
                  onOpenAdminManager={() => {
                    setActiveTab('admin');
                    setProfileTab('whats_new');
                  }}
                />
              )}

              {/* Tab: About Veylentra Dedicated Page */}
              {activeTab === 'about' && (
                <AboutVeylentraPage onNavigateTab={handleTabSelect} />
              )}

                </motion.div>
              </AnimatePresence>
            </main>

            {/* Mobile Bottom Navigation Bar (Phones < 768px & Installed Mobile PWA) */}
            {!presentationMode && activeTab !== 'whiteboard' && (
              <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 px-1 pt-1.5 pb-2 safe-area-pb flex items-center justify-around gap-0.5">
                {[
                  { id: 'dashboard', label: 'Home', icon: '🏠' },
                  { id: 'study_hub', label: 'Study', icon: '🎯', badge: dueCardsCount > 0 ? dueCardsCount : 0 },
                  { id: 'peer_chat', label: 'Chat', icon: '🌍' },
                  { id: 'ai_teacher', label: 'Byte', icon: '🤖' },
                ].map((item) => {
                  const isActive = item.id === 'study_hub'
                    ? ['study_hub', 'tasks', 'planner', 'flashcards'].includes(activeTab)
                    : activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleTabSelect(item.id)}
                      className={`relative flex flex-col items-center justify-center py-1 px-1 sm:px-2.5 rounded-xl flex-1 min-w-0 min-h-[42px] sm:min-h-[44px] transition-all cursor-pointer ${
                        isActive
                          ? 'text-indigo-400 bg-indigo-500/15 font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 font-semibold'
                      }`}
                    >
                      <span className="text-sm sm:text-base leading-none">{item.icon}</span>
                      <span className="text-[9px] sm:text-[10px] mt-1 leading-none tracking-tight truncate max-w-full">{item.label}</span>
                      {item.badge ? (
                        <span className="absolute top-0.5 right-1 px-1 min-w-[14px] h-[14px] rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center leading-none">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className={`flex flex-col items-center justify-center py-1 px-1 sm:px-2.5 rounded-xl flex-1 min-w-0 min-h-[42px] sm:min-h-[44px] transition-all cursor-pointer ${
                    sidebarOpen ? 'text-indigo-400 bg-indigo-500/15 font-extrabold' : 'text-slate-400 hover:text-slate-200 font-semibold'
                  }`}
                >
                  <span className="text-sm sm:text-base leading-none">☰</span>
                  <span className="text-[9px] sm:text-[10px] mt-1 leading-none tracking-tight truncate max-w-full">Menu</span>
                </button>
              </nav>
            )}

            {/* Orion (Jarvis) Drawer Overlay */}
            {isJarvisActive && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm animate-fadeIn" 
                  onClick={() => setIsJarvisActive(false)}
                />
                
                {/* Modal Overlay for Orion */}
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-8 animate-fadeIn pointer-events-none">
                  <div className="w-full max-w-6xl h-full max-h-[92dvh] sm:max-h-[85vh] pointer-events-auto shadow-[0_0_80px_-15px_rgba(79,70,229,0.3)] rounded-2xl sm:rounded-3xl overflow-hidden relative border border-white/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-slate-950/95 to-violet-900/20 backdrop-blur-3xl" />
                    <div className="relative h-full w-full">
                  <StudentOSJarvis 
                    onClose={() => setIsJarvisActive(false)}
                    activeTab={activeTab}
                    setActiveTab={handleTabSelect}
                    clearWhiteboard={clearCanvas}
                    drawShapeOnWhiteboard={drawShapeOnWhiteboard}
                    setTriggerQuickQuiz={(val: boolean) => setQuizStarted(val)}
                    saveWhiteboard={() => {
                      const canvas = whiteboardRef.current;
                      if (canvas) {
                        try {
                          const url = canvas.toDataURL('image/png');
                          const filename = `whiteboard-snapshot-${Date.now()}.png`;
                          if (typeof (window as any).downloadAIVoice === 'function') {
                            (window as any).downloadAIVoice(url, filename);
                          } else {
                            const link = document.createElement('a');
                            link.download = filename;
                            link.href = url;
                            link.click();
                          }
                          showNotification('✓ Whiteboard snapshot compiled and downloaded successfully!');
                        } catch (e) {
                          showNotification('Failed to generate blackboard snapshot.');
                        }
                      }
                    }}
                    setSearchMaterialsQuery={setMaterialsSearchQuery}
                    showNotification={showNotification}
                    createVaultNote={(title: string, content: string, subject: string) => {
                      const newId = 'note-' + Date.now();
                      const newNote = {
                        id: newId,
                        title: title || 'AI Research Notes',
                        subject: subject || 'Orion Generated',
                        content: content || '',
                        createdAt: new Date().toLocaleDateString(),
                        icon: '🧠',
                        coverBg: 'bg-gradient-to-r from-violet-600 to-indigo-900',
                        userId: currentUser?.uid || 'guest'
                      };
                      setVaultNotes(prev => {
                        const updated = [...prev, newNote];
                        if (currentUser) {
                          (async () => {
       const newArr = updated;
       for (const n of newArr) {
          saveVaultNoteToSupabase(n).catch(()=>{});
       }
     })();
                        }
                        return updated;
                      });
                    }}
                    onSuperAdminUnlocked={async () => {
                      setIsSuperAdmin(true);
                      setSimulatedRole('admin');
                      if (currentUser && currentUser.uid) {
                        try {
                          const updatedProfile = {
                            ...currentUser,
                            role: 'super_admin' as const,
                            accountStatus: 'approved' as const
                          };
                          try {
                            await saveSupabaseUserProfile(updatedProfile);
                          } catch (sbErr) {
                            console.error('[Supabase] Failed to elevate role in Supabase:', sbErr);
                            throw sbErr;
                          }
                          showNotification('SYSTEM: Database authority elevated to Super Admin.');
                        } catch (e) {
                          console.error('Failed to elevate role:', e);
                        }
                      }
                    }}
                    currentUser={currentUser}
                    effectiveRole={effectiveRole as any}
                  />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      
      {/* Group Settings Modal */}
      {showGroupSettings && activeChatTargetId && (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl animate-fadeIn">
            <div className="absolute top-4 right-4 flex gap-2">
               {(() => {
                 const room = chatRooms.find(r => r.id === activeChatTargetId);
                 if (room && room.creatorId === currentUser?.uid) {
                    return (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
                            // Call delete group logically (placeholder for DB delete)
                            setChatRooms(prev => prev.filter(r => r.id !== activeChatTargetId));
                            setActiveChatTargetId('group-all');
                            setShowGroupSettings(false);
                            showNotification('Group deleted successfully.');
                          }
                        }}
                        className="text-[10px] text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 rounded-lg border border-rose-500/20 font-bold uppercase transition-all"
                      >
                        Delete Group
                      </button>
                    );
                 }
                 return null;
               })()}
              <button
                onClick={() => setShowGroupSettings(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>
            
            <h2 className="text-xl font-black text-white mb-6">Group Settings</h2>
            
            {(() => {
              const room = chatRooms.find(r => r.id === activeChatTargetId);
              if (!room) return null;
              
              return (
                <div className="space-y-4">
                   <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Group Name</label>
                     <div className="flex gap-2">
                       <input 
                         type="text" 
                         defaultValue={room.name} 
                         id="edit-group-name"
                         className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" 
                       />
                     </div>
                   </div>
                   
                   <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Description</label>
                     <textarea 
                       defaultValue={room.description} 
                       id="edit-group-desc"
                       rows={2}
                       className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white resize-none" 
                     />
                   </div>
                   
                   <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Icon</label>
                     <input 
                       type="text" 
                       defaultValue={room.icon} 
                       id="edit-group-icon"
                       className="w-20 text-center bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-base text-white" 
                     />
                   </div>
                   
                   <div className="pt-2">
                     <button
                       onClick={() => {
                         const newName = (document.getElementById('edit-group-name') as HTMLInputElement).value;
                         const newDesc = (document.getElementById('edit-group-desc') as HTMLTextAreaElement).value;
                         const newIcon = (document.getElementById('edit-group-icon') as HTMLInputElement).value;
                         
                         const updatedRoom = { ...room, name: newName, description: newDesc, icon: newIcon };
                         setChatRooms(prev => prev.map(r => r.id === room.id ? updatedRoom : r));
                         // Assume saving to DB logic is implemented by syncing state here
                         setShowGroupSettings(false);
                         showNotification('Group settings updated!');
                       }}
                       className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all"
                     >
                       Save Changes
                     </button>
                   </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}


      {/* DEV & SUPER ADMIN Role Switcher */}
      {false && (
        <div className="fixed bottom-4 right-4 z-[100] bg-slate-900 border border-indigo-500/50 shadow-[0_0_40px_rgba(79,70,229,0.3)] p-4 rounded-2xl flex flex-col gap-2 max-w-xs animate-fadeIn">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">
              {isSuperAdmin ? '⚡ Super Admin Mode' : '🛠️ Dev Role Switcher'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mb-2 leading-tight">
            Original auth role: <strong className="text-white">{currentUser.role}</strong><br/>
            Simulated role: <strong className="text-emerald-400">{effectiveRole}</strong>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['student', 'teacher', 'coordinator', 'admin'] as UserRole[]).map(role => (
              <button
                key={role}
                onClick={() => setSimulatedRole(role)}
                className={`text-[10px] uppercase font-bold py-1.5 px-2 rounded border transition-all ${effectiveRole === role ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}
              >
                {role}
              </button>
            ))}
          </div>
          <button 
            onClick={() => {
              setSimulatedRole(null);
              if (isSuperAdmin) setIsSuperAdmin(false);
            }}
            className="mt-1 text-[10px] uppercase font-bold py-1.5 px-2 rounded bg-slate-950 text-slate-400 hover:text-white border border-white/5 transition-all w-full"
          >
            {isSuperAdmin ? 'Exit Super Admin Mode' : 'Reset to Auth Role'}
          </button>
        </div>
      )}

      {/* Privileged PIN Verification Modal Gate */}
      {isPinModalOpen && securityVerificationAcc && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] overflow-y-auto flex items-center justify-center p-4">
          <div className="smart-glass max-w-md w-full p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6 animate-fadeIn text-center">
            <div className="space-y-2">
              <div className="inline-flex h-12 w-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 items-center justify-center text-2xl">🔒</div>
              <h2 className="text-xl font-black font-display text-white">Privileged Gate Verification</h2>
              <p className="text-xs text-slate-400">
                A security challenge is active for administrative roles. Enter the 4-digit security PIN for <strong className="text-white">{securityVerificationAcc.name}</strong> to proceed.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={enteredVerificationPin}
                  onChange={(e) => {
                    setEnteredVerificationPin(e.target.value.replace(/\D/g, ''));
                    setPinVerificationError('');
                  }}
                  placeholder="••••"
                  className="w-full text-center text-2xl tracking-widest font-mono py-3.5 rounded-2xl bg-slate-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                  autoFocus
                />
                {pinVerificationError && (
                  <p className="text-xs font-semibold text-red-400 animate-pulse mt-1.5">{pinVerificationError}</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVerifyPinAndLogin}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-all shadow-lg"
                >
                  Verify PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBroadcastModalOpen && (
        <BroadcastModal
          currentUser={currentUser}
          effectiveRole={effectiveRole}
          isOpen={isBroadcastModalOpen}
          onClose={() => setIsBroadcastModalOpen(false)}
          showNotification={showNotification}
        />
      )}

      {showQuotaModal && (
        <AIQuotaManagerModal
          isOpen={showQuotaModal}
          onClose={() => setShowQuotaModal(false)}
          usageState={aiUsageState}
          userId={currentUser?.uid || 'guest'}
          userName={currentUser?.name || 'Student'}
          userEmail={currentUser?.email}
          userRole={effectiveRole || currentUser?.role || 'student'}
          onQuotaUpdated={(updated) => setAiUsageState(updated)}
        />
      )}

      {isInstallAppModalOpen && (
        <InstallAppModal
          isOpen={isInstallAppModalOpen}
          onClose={() => setIsInstallAppModalOpen(false)}
          isSuperAdmin={Boolean(isSuperAdmin || effectiveRole === 'super_admin' || currentUser?.role === 'super_admin')}
          effectiveRole={effectiveRole || currentUser?.role || 'student'}
          currentUserName={currentUser?.name || currentUser?.email || 'Super Admin'}
        />
      )}

      {isSoundSettingsModalOpen && (
        <SoundSettingsModal
          isOpen={isSoundSettingsModalOpen}
          onClose={() => setIsSoundSettingsModalOpen(false)}
        />
      )}

      {/* Major Release Announcement Banner */}
      <MajorReleaseBanner
        currentUser={currentUser}
        effectiveRole={effectiveRole}
        onNavigateTab={handleTabSelect}
      />

      {/* Global Gamification XP & Level-Up Reward Toast */}
      <GamificationRewardToast />

      {/* Global School Calling System & WebRTC Overlay */}
      <GlobalSchoolCallModal
        currentUser={currentUser}
        effectiveRole={effectiveRole}
        allUsers={students}
        onNavigateTab={handleTabSelect}
      />

      {/* Classroom Panel Board Setup Dialog */}
      {showPanelSetupDialog && (
        <PanelBoardSetupDialog
          currentUser={currentUser}
          effectiveRole={effectiveRole}
          onSuccess={(reg) => {
            setPanelBoardRegistration(reg);
            setShowPanelSetupDialog(false);
            setIsPanelBoardOpen(true);
            showNotification('✓ Classroom Panel Board registered successfully!');
          }}
          onContinueGuest={() => {
            setShowPanelSetupDialog(false);
            setIsPanelBoardOpen(true);
          }}
          onCancel={() => {
            setShowPanelSetupDialog(false);
          }}
        />
      )}

      {/* Active Classroom Panel Board Workspace */}
      {isPanelBoardOpen && (
        <ClassroomPanelBoard
          registration={panelBoardRegistration}
          currentUser={currentUser}
          effectiveRole={effectiveRole}
          onExit={() => setIsPanelBoardOpen(false)}
          onReassignRequest={() => {
            setIsPanelBoardOpen(false);
            setShowPanelSetupDialog(true);
          }}
          showNotification={showNotification}
        />
      )}

      {/* In-App Document Viewer */}
      {inAppViewerDoc && (
        <InAppDocumentViewer
          url={inAppViewerDoc.url}
          title={inAppViewerDoc.title}
          fileName={inAppViewerDoc.fileName}
          fileType={inAppViewerDoc.fileType}
          currentUser={currentUser}
          showNotification={showNotification}
          onClose={() => setInAppViewerDoc(null)}
          onDownload={() => {
            const name = inAppViewerDoc.fileName || inAppViewerDoc.title || 'document';
            if (typeof (window as any).openExternalDownload === 'function') {
              (window as any).openExternalDownload(inAppViewerDoc.url, name);
            } else {
              const link = document.createElement('a');
              link.href = inAppViewerDoc.url;
              link.download = name;
              link.target = '_blank';
              link.click();
            }
          }}
          onShareToChat={() => {
            showNotification('Shared document link to active chat stream.');
          }}
        />
      )}

      {/* Global Byte Learning Modal Triggered from Byte Chat Intent Detection */}
      <AnimatePresence>
        {selectedTopicForTutor && currentUser && (
          <AITopicTutorModal
            subject={currentUser?.specialtySubject || 'General Studies'}
            chapter={{
              id: 'chapter-dynamic',
              chapterNumber: 1,
              title: selectedTopicForTutor,
              topics: [selectedTopicForTutor],
              description: `Dynamic learning session for ${selectedTopicForTutor}`,
              examRelevance: 'high',
              status: 'published',
              lastUpdated: new Date().toISOString().split('T')[0]
            }}
            topic={selectedTopicForTutor}
            grade={currentUser?.grade || 'Grade 10'}
            currentUser={currentUser}
            isMastered={false}
            onClose={() => setSelectedTopicForTutor(null)}
            onMasterTopic={async (top, score) => {
              if (currentUser?.uid) {
                const chapterKey = 'dynamic_' + top.toLowerCase().replace(/[^a-z0-9]/g, '_');
                const subject = currentUser.specialtySubject || 'General Studies';
                try {
                  const { SyllabusTimetableService } = await import('./lib/syllabusTimetableService');
                  await SyllabusTimetableService.updateStudentChapterProgress(
                    currentUser.uid,
                    chapterKey,
                    subject,
                    {
                      status: 'completed',
                      completedTopics: [top],
                      confidenceRating: 5,
                      topicMasteryRecords: {
                        [top]: {
                          mastered: true,
                          score,
                          totalQuestions: 2,
                          completedAt: new Date().toISOString(),
                          attempts: 1
                        }
                      }
                    }
                  );
                } catch (e) {
                  console.warn('Could not sync dynamic chapter progress:', e);
                }
                try {
                  const { awardStudentXP } = await import('./lib/gamification');
                  await awardStudentXP(currentUser, 'use_ai_study', {
                    customXpAmount: 50,
                    customLabel: `Mastered topic: ${top} with Byte!`
                  });
                } catch (_) {}
              }
              showNotification(`🎉 Topic Mastered: "${top}" (Score: ${score}%) +50 Scholar XP!`);
            }}
            showNotification={showNotification}
            onOpenByteChat={() => setSelectedTopicForTutor(null)}
          />
        )}
      </AnimatePresence>

      {/* Floating Duolingo-style Byte Widget with Procedural 3D Character — hidden on auth / sign up page */}
      {currentUser && !isOnboardingModalOpen && (
        <FloatingByteWidget
          activeTab={activeTab}
          currentUser={currentUser}
          tasks={tasks}
          homeworkList={homeworkList}
          announcements={announcements}
          dueCardsCount={dueCardsCount}
          onNavigateTab={handleTabSelect}
        />
      )}

      {/* First-Time Guided Onboarding Setup Modal */}
      {isOnboardingModalOpen && (
        <StudentOSOnboardingModal
          currentUser={currentUser}
          isOpen={isOnboardingModalOpen}
          onClose={() => setIsOnboardingModalOpen(false)}
          onStartTour={() => {
            setIsOnboardingModalOpen(false);
            setIsProductTourOpen(true);
          }}
        />
      )}

      {/* Role-Aware Spotlight Product Tour */}
      {isProductTourOpen && (
        <GuidedProductTour
          userRole={effectiveRole || 'student'}
          onNavigateTab={handleTabSelect}
          onComplete={() => {
            setIsProductTourOpen(false);
            showNotification('✓ Tour completed! Byte is here in the bottom corner whenever you need help.');
          }}
          onSkip={() => {
            setIsProductTourOpen(false);
          }}
        />
      )}

      {/* AI Thread Hold Menu */}
      {aiThreadHoldMenu && (
        <div 
          className="fixed z-[100] w-48 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in duration-150"
          style={{ left: Math.min(window.innerWidth - 200, aiThreadHoldMenu.x), top: Math.min(window.innerHeight - 300, aiThreadHoldMenu.y) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handlePinThread(aiThreadHoldMenu.threadId)}
              className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
            >
              <Pin className="w-3.5 h-3.5 text-amber-400" />
              {aiThreads.find(t => t.id === aiThreadHoldMenu.threadId)?.isPinned ? 'Unpin Session' : 'Pin Session'}
            </button>
            <button
              onClick={() => handleRenameThread(aiThreadHoldMenu.threadId)}
              className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
            >
              <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
              Rename
            </button>
            <div className="h-px bg-white/5 my-1" />
            <button
              onClick={(e) => {
                handleDeleteThread(aiThreadHoldMenu.threadId);
              }}
              className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Session
            </button>
          </div>
        </div>
      )}
      {aiThreadHoldMenu && <div className="fixed inset-0 z-[99]" onClick={() => setAiThreadHoldMenu(null)} />}

      {/* Vault Item Hold Menu */}
      {vaultItemHoldMenu && (
        <div 
          className="fixed z-[100] w-52 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in duration-150"
          style={{ left: Math.min(window.innerWidth - 220, vaultItemHoldMenu.x), top: Math.min(window.innerHeight - 340, vaultItemHoldMenu.y) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handlePinVaultNote(vaultItemHoldMenu.noteId)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
            >
              <Pin className="w-3.5 h-3.5 text-amber-400" />
              {vaultNotes.find(n => n.id === vaultItemHoldMenu.noteId)?.isPinned ? 'Unpin Note' : 'Pin Note'}
            </button>
            <button
              onClick={() => handleRenameVaultNote(vaultItemHoldMenu.noteId)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
            >
              <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
              Rename Note
            </button>
            <button
              onClick={() => handleShareVaultNote(vaultItemHoldMenu.noteId)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              Share (6-digit Collab)
            </button>
            <div className="h-px bg-white/5 my-1" />
            <div className="px-3 py-1 text-[9px] font-black text-slate-500 uppercase">Move to Folder</div>
            <button
              onClick={() => handleMoveVaultNoteToFolder(vaultItemHoldMenu.noteId, null)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
            >
              <Move className="w-3.5 h-3.5 text-slate-400" />
              Root (No Folder)
            </button>
            {vaultFolders.map(f => (
              <button
                key={f.id}
                onClick={() => handleMoveVaultNoteToFolder(vaultItemHoldMenu.noteId, f.id)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all"
              >
                <Move className="w-3.5 h-3.5 text-indigo-400" />
                {f.name}
              </button>
            ))}
            <div className="h-px bg-white/5 my-1" />
            <button
              onClick={() => handleDeleteVaultNote(vaultItemHoldMenu.noteId)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Note
            </button>
          </div>
        </div>
      )}
      {vaultItemHoldMenu && <div className="fixed inset-0 z-[99]" onClick={() => setVaultItemHoldMenu(null)} />}

      {/* Vault Folder Creation Modal */}
      {showVaultFolderModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-indigo-400" />
              New Personal Notes Folder
            </h3>
            <input
              type="text"
              value={newVaultFolderName}
              onChange={(e) => setNewVaultFolderName(e.target.value)}
              placeholder="e.g. Physics Formulae & Derivations"
              className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
              autoFocus
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newVaultFolderName.trim() && currentUser?.uid) {
                  try {
                    const f = await createFolder(newVaultFolderName.trim(), 'notes', currentUser.uid);
                    if (f) {
                      setVaultFolders(prev => [f, ...prev]);
                      setNewVaultFolderName('');
                      setShowVaultFolderModal(false);
                      showNotification('📁 Personal Notes folder created!');
                    }
                  } catch (err: any) {
                    showNotification(`⚠️ Failed to create folder: ${err.message || 'Database error'}`);
                  }
                }
              }}
            />
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowVaultFolderModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newVaultFolderName.trim() || !currentUser?.uid) return;
                  try {
                    const f = await createFolder(newVaultFolderName.trim(), 'notes', currentUser.uid);
                    if (f) {
                      setVaultFolders(prev => [f, ...prev]);
                      setNewVaultFolderName('');
                      setShowVaultFolderModal(false);
                      showNotification('📁 Personal Notes folder created!');
                    }
                  } catch (err: any) {
                    showNotification(`⚠️ Failed to create folder: ${err.message || 'Database error'}`);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-500 transition-colors"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vault Folder Rename Modal */}
      {renameVaultFolderModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-3.5">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-amber-400" />
              <span>Rename Personal Notes Folder</span>
            </h3>
            <input
              type="text"
              value={renameVaultInput}
              onChange={(e) => setRenameVaultInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameVaultFolder();
              }}
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setRenameVaultFolderModal(null)}
                className="flex-1 px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameVaultFolder}
                className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-500 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Absolute Dynamic Alert Center */}
      <div className="fixed top-4 sm:top-6 right-4 sm:right-6 left-4 sm:left-auto z-[99999] flex flex-col gap-2.5 sm:max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="smart-glass animate-bounce text-xs font-semibold px-4 py-3.5 rounded-xl border border-white/10 text-white shadow-xl flex items-center gap-2 pointer-events-auto bg-slate-900/90">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            <span className="break-words min-w-0">{t.msg}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
