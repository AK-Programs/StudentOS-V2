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
  Key, ArrowLeft, FolderPlus, Pin, Edit2, Move, Folder, Users2, Copy, CheckCheck, Columns, ListOrdered, List, Info, Menu
} from 'lucide-react';
import { 
  UserRole, HouseType, SectionType, UserProfile, HouseStats, 
  Task, ScheduleItem, VaultNote, Lesson, FeedbackPost, 
  MaterialResource, QuizQuestion, ChatMessage, ChatRoom, AITeacherPersona,
  Homework, RecentAccount, AppNotification
} from './types';
import { supabase } from './lib/supabase';
import { getVaultNotes, saveVaultNoteToSupabase, deleteVaultNoteFromSupabase, getNoteByCollabCode, updateNoteOrder } from './lib/supabaseNotes';
import { generateFormattedPdf } from './lib/pdfGenerator';
import { getSupabaseUserProfile, saveSupabaseUserProfile, getDefaultProfileForAccount, saveLocalProfileBackup, clearSupabaseUserProfileCache } from './lib/supabaseUsers';
import { getSupabaseHomework, saveSupabaseHomework, deleteSupabaseHomework } from './lib/supabaseHomework';
import {
  fetchAssignments,
  fetchAssessments,
  fetchTargetedAnnouncements,
  isAnnouncementEligibleForUser,
  isStudentMatchedToCohort,
  saveAssignment
} from './lib/academicWorkflowService';
import { getPersonalTasks, savePersonalTask, updateTaskOrder as saveTaskOrderToSupabase, deletePersonalTask } from './lib/supabaseTasks';
import { getAppNotifications, saveAppNotification, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, generateUUID, registerPushSubscription, getDeviceId, triggerBrowserPushNotification, isUserEligibleForNotification, triggerNotificationSound } from './lib/notifications';
import { requestFCMPermission, setupFCMForegroundListener } from './lib/fcmNotifications';
import { useContextHoldMenu, useDismissContextMenu } from './lib/useContextHoldMenu';
import { awardStudentXP, isHalloweenBadgeDateRange } from './lib/gamification';
import { getSavedTheme } from './lib/themeSystem';
import { ALL_GRADE_OPTIONS, getSectionsForGrade } from './config/academicHierarchy';
import { StudentGamificationHub } from './components/StudentGamificationHub';
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
import { FeedbackBoard } from './components/FeedbackBoard';
import { StudentOSJarvis } from './components/StudentOSJarvis';
import AttendanceManager from './components/AttendanceManager';
import AdminCenter, { AdminSubTab } from './components/AdminCenter';
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
import { LectureNotesAiModal } from './components/LectureNotesAiModal';
import { LectureNotesWorkspace } from './components/lectureNotes/LectureNotesWorkspace';
import { HomeworkLinkedNotesSection } from './components/lectureNotes/HomeworkLinkedNotesSection';
import { NotificationFlyout } from './components/NotificationFlyout';
import { NativeContextMenu } from './components/ui/NativeContextMenu';
import { LevelUpCelebrationModal } from './components/gamification/LevelUpCelebrationModal';
import { RegularBadgeUnlockModal } from './components/gamification/RegularBadgeUnlockModal';
import { StreakRecoveryCelebrationModal } from './components/gamification/StreakRecoveryCelebrationModal';
import { UnifiedEngagementPanel } from './components/engagement/UnifiedEngagementPanel';
import { useEngagementOverview, recordEngagementActivity } from './lib/engagementService';
import { ParentalPortal } from './components/ParentalPortal';
import { BrainBattleArena } from './components/BrainBattleArena';
import { SyllabusStudyPlanner } from './components/SyllabusStudyPlanner';
import { StudyHubDashboard } from './components/StudyHubDashboard';
import { StudyHubTaskManager } from './components/StudyHubTaskManager';
import { OfficialTimetableViewer } from './components/OfficialTimetableViewer';
import { StudentExperienceWorkspace } from './components/StudentExperienceWorkspace';
import { FacultyExperienceWorkspace } from './components/FacultyExperienceWorkspace';
import { ByteOrionAssistantModal } from './components/ByteOrionAssistantModal';
import { buildByteReminders } from './lib/byteReminderEngine';
import { isFacultyRole } from './config/facultyPermissions';
import { ReminderService } from './lib/reminderService';
import { ProfessionalTabDropdown } from './components/ProfessionalTabDropdown';
import { getStoredCards } from './lib/flashcardStorage';
import { isCardDue } from './lib/sm2Algorithm';
import { getPublishedUpdates, getUserReadUpdateIds } from './lib/supabaseUpdates';
import { soundService } from './lib/soundService';
import { SoundSettingsModal } from './components/SoundSettingsModal';
import { sendRealtimeEvent, subscribeRealtimeEvents } from './lib/wsHelper';
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
import { DashboardTopBar } from './components/DashboardTopBar';
import {
  consumePendingNotificationIntent,
  NotificationNavIntent,
  parseNotificationIntentFromLocation,
  peekPendingNotificationIntent,
  persistPendingNotificationIntent,
  resolveNotificationDestination,
  stripNotificationParamsFromUrl,
} from './lib/notificationNavigation';
import { MOCK_QUIZZES, AI_PERSONAS, INITIAL_ANNOUNCEMENTS, INITIAL_FEEDBACK, INITIAL_MATERIALS, MOCK_SCHEDULES } from './mockData';
import { FloatingByteWidget } from './components/byte/FloatingByteWidget';
import { StudentOSOnboardingModal } from './components/onboarding/StudentOSOnboardingModal';
import { GuidedProductTour } from './components/onboarding/GuidedProductTour';
import { shouldShowOnboarding } from './lib/onboardingService';
import { BottomSheet } from './components/ui/BottomSheet';
import { VeylentraIcon } from './components/ui/VeylentraIcon';
import { useFeatureAccess, isSuperAdminRole } from './lib/featureAccessService';
import { WinterThemeLayer } from './components/winter/WinterThemeLayer';
import { WinterFestivalHub } from './components/winter/WinterFestivalHub';
import { FloatingSpinWheelButton } from './components/winter/FloatingSpinWheelButton';
import { XpLeaderboardPanel } from './components/gamification/XpLeaderboardPanel';
import { SnowflakeVector } from './components/winter/WinterArtwork';
import { scheduleSantaModelIdlePreload } from './lib/santaModelCache';
import { ProfileBannerBackdrop, ProfileCosmeticAvatar } from './components/winter/ProfileCosmeticRenderer';
import { fetchPublicWinterCosmetics } from './lib/winterFestivalService';
import { BadgeUnlockCelebrationModal } from './components/winter/BadgeUnlockCelebrationModal';
import { prefersReducedMotion } from './lib/motionSystem';
import { AcademicRichRenderer } from './components/ui/AcademicRichRenderer';
import { ByteWorkspace } from './components/byte/ByteWorkspace';

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
import { AppView } from './components/app/AppView';

const generateUniqueId = () => {
  return crypto.randomUUID();
};

const renderMarkdown = (rawText: string, isStreaming = false) => {
  if (!rawText) return null;
  return <AcademicRichRenderer content={rawText} isStreaming={isStreaming} />;
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

  if (role === 'parent') {
    return 'Parent / Guardian';
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

  // Request notification permission & sync FCM tokens to Firestore & backend after sign-in
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && currentUser?.uid) {
      const uid = currentUser.uid;
      const meta = {
        role: currentUser.role || 'student',
        grade: currentUser.grade || '',
        section: currentUser.section || '',
        house: currentUser.house || '',
        schoolId: (currentUser as any)?.schoolId || 'default_school'
      };
      void requestFCMPermission(uid, meta, { silentIfDefault: true });
    }
  }, [currentUser?.uid, currentUser?.role, currentUser?.grade, currentUser?.section, currentUser?.house]);

  // Setup FCM Foreground message listener & merge incoming SW/FCM pushes into in-app notifications/flyout
  useEffect(() => {
    let cleanupListener: (() => void) | null = null;
    const mergeForegroundPush = (detail: any) => {
      const user = currentUserRef.current;
      if (!detail || !user?.uid) return;
      const d = detail?.data && typeof detail.data === 'object' ? detail.data : detail;
      const incomingId = String(detail.notifId || d.notifId || d.notificationId || detail.tag || `fcm-${Date.now()}`).trim();
      const incomingType = (String(detail.type || d.type || 'announcement').toLowerCase() || 'announcement') as AppNotification['type'];
      const incomingLinkTab = String(detail.linkTab || d.linkTab || d.tab || 'notice_viewer').trim();
      const nextNotif: AppNotification = {
        id: incomingId,
        title: String(detail.title || d.title || '📢 Veylentra Notice'),
        message: String(detail.body || d.body || d.message || ''),
        type: incomingType,
        createdAt: new Date().toISOString(),
        isRead: false,
        targetUserId: user.uid,
        targetRole: 'all',
        linkTab: incomingLinkTab,
      };
      setNotifications((prev) => {
        if (prev.some((n) => n.id === nextNotif.id)) {
          return prev;
        }
        return [nextNotif, ...prev];
      });
    };

    const handleForegroundPushEvent = (e: Event) => {
      mergeForegroundPush((e as CustomEvent)?.detail);
    };
    window.addEventListener('studentos-fcm-foreground-message', handleForegroundPushEvent);

    setupFCMForegroundListener((payload) => {
      mergeForegroundPush(payload);
    }).then(unsub => {
      cleanupListener = unsub;
    });

    return () => {
      window.removeEventListener('studentos-fcm-foreground-message', handleForegroundPushEvent);
      if (cleanupListener) cleanupListener();
    };
  }, []);

  const applyNotificationNavigationRef = useRef<(intent: NotificationNavIntent) => void>(() => {});
  const authReadyForNavRef = useRef<boolean>(false);

  // Listen for normalized notification navigation events (from SW postMessage, foreground push, or local clicks)
  useEffect(() => {
    const handleNavigateEvent = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationNavIntent>;
      const intent = customEvent?.detail;
      if (!intent) return;
      if (authReadyForNavRef.current) {
        consumePendingNotificationIntent();
        applyNotificationNavigationRef.current(intent);
      } else {
        persistPendingNotificationIntent(intent);
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

    if (currentUser) {
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
    }

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



  const [isSoundSettingsModalOpen, setIsSoundSettingsModalOpen] = useState<boolean>(false);
  const [leaderboardTabView, setLeaderboardTabView] = useState<'student' | 'faculty'>('student');
  const studentLbAccess = useFeatureAccess('student_xp_leaderboard', currentUser);
  const facultyLbAccess = useFeatureAccess('faculty_xp_leaderboard', currentUser);
  const winterThemeAccess = useFeatureAccess('winter_theme', currentUser);
  const winterTasksAccess = useFeatureAccess('winter_festival_tasks', currentUser);
  const winterBadgesAccess = useFeatureAccess('winter_badges', currentUser);
  const winterSantaAccess = useFeatureAccess('winter_santa_gifts', currentUser);
  const {
    overview: engagementOverview,
    loading: engagementLoading,
    refresh: refreshEngagementOverview,
  } = useEngagementOverview(currentUser, effectiveRole);
  const lastNoteEngagementAtRef = useRef<number>(0);
  const winterSpinAccess = useFeatureAccess('winter_spin_wheel', currentUser);

  const isFacultyRoleForLb = ['teacher', 'coordinator', 'hod', 'admin'].includes((effectiveRole || '').toLowerCase());
  const canViewLeaderboardTab =
    isSuperAdminRole(currentUser?.role) || isSuperAdminRole(effectiveRole)
      ? (studentLbAccess.accessible || facultyLbAccess.accessible)
      : (isFacultyRoleForLb ? facultyLbAccess.accessible : studentLbAccess.accessible);
  const canViewWinterHub =
    winterThemeAccess.accessible ||
    winterTasksAccess.accessible ||
    winterBadgesAccess.accessible ||
    winterSantaAccess.accessible ||
    winterSpinAccess.accessible;

  const [sidebarWinterCosmetics, setSidebarWinterCosmetics] = useState<{ equippedBanner: string | null; equippedBorder: string | null }>({
    equippedBanner: null,
    equippedBorder: null,
  });

  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) {
      setSidebarWinterCosmetics({ equippedBanner: null, equippedBorder: null });
      return;
    }
    let active = true;
    const syncCosmetics = async () => {
      const cos = await fetchPublicWinterCosmetics(uid, currentUser);
      if (active && cos) {
        setSidebarWinterCosmetics({
          equippedBanner: cos.equippedBanner || null,
          equippedBorder: cos.equippedBorder || null,
        });
      }
    };
    void syncCosmetics();
    const onWinterUpdate = () => { void syncCosmetics(); };
    window.addEventListener('veylentra-winter-updated', onWinterUpdate);
    window.addEventListener('veylentra-cosmetics-updated', onWinterUpdate);
    return () => {
      active = false;
      window.removeEventListener('veylentra-winter-updated', onWinterUpdate);
      window.removeEventListener('veylentra-cosmetics-updated', onWinterUpdate);
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (currentUser && !dataLoading && winterSantaAccess.accessible) {
      return scheduleSantaModelIdlePreload();
    }
  }, [currentUser?.uid, dataLoading, winterSantaAccess.accessible]);

  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);
  const [isProductTourOpen, setIsProductTourOpen] = useState<boolean>(false);

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
        const cachedRole = currentUser?.role;
        const urlIntent = parseNotificationIntentFromLocation(window.location.search, window.location.hash);
        if (urlIntent) {
          persistPendingNotificationIntent(urlIntent);
          return resolveNotificationDestination(urlIntent, cachedRole).tab;
        }
        const pendingIntent = peekPendingNotificationIntent();
        if (pendingIntent) {
          return resolveNotificationDestination(pendingIntent, cachedRole).tab;
        }
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
  const [studyHubSubTab, setStudyHubSubTab] = useState<'dashboard' | 'tasks' | 'planner' | 'flashcards'>('dashboard');
  const [selectedAdminSubTab, setSelectedAdminSubTab] = useState<AdminSubTab | undefined>(undefined);
  const [selectedFlashcardDeckId, setSelectedFlashcardDeckId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'tasks') setStudyHubSubTab('tasks');
    else if (activeTab === 'planner') setStudyHubSubTab('planner');
    else if (activeTab === 'flashcards') setStudyHubSubTab('flashcards');

    try {
      localStorage.setItem('s_os_active_tab', activeTab);
      presenceService.updateCurrentTab(activeTab);
      if (currentUser) {
        logTabOpen(activeTab, currentUser);
        if (activeTab === 'study_hub' && studyHubSubTab === 'dashboard') {
          // Refresh due cards count
          const cards = getStoredCards();
          setDueCardsCount(cards.filter(c => isCardDue(c)).length);
        }
      }
    } catch (_) {}
  }, [activeTab, currentUser]);

  // Ensure Parent role always defaults to parental portal
  useEffect(() => {
    if (effectiveRole === 'parent') {
      const allowedParentTabs = ['parent_portal', 'profile', 'whats_new', 'about'];
      if (!allowedParentTabs.includes(activeTab)) {
        setActiveTab('parent_portal');
      }
    }
  }, [effectiveRole, activeTab]);

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
      } else if (path === '/study-dashboard') {
        setActiveTab('study_hub');
        setStudyHubSubTab('dashboard');
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
  const [accountSwitcherExpanded, setAccountSwitcherExpanded] = useState<boolean>(false);
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

  const [regRole, setRegRole] = useState<'student' | 'teacher' | 'coordinator' | 'admin' | 'parent'>('student');
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
      if (effectiveRole === 'student') {
        const studentGrade = currentUser?.grade || 'Grade 10';
        const studentSec = currentUser?.section || 'Astra';
        setPanelBoardRegistration({
          id: reg?.id || `student_panel_${currentUser?.uid || 'guest'}`,
          school_id: reg?.school_id || 'default_school',
          class_id: studentGrade,
          section_id: studentSec,
          display_name: `${studentGrade} (${studentSec}) Classroom Board`,
          registered_by: currentUser?.uid || 'student',
          status: 'active',
          device_token: reg?.device_token || 'student_view_token',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        setIsPanelBoardOpen(true);
        return;
      }

      if (reg && reg.status === 'active') {
        setPanelBoardRegistration(reg);
        setIsPanelBoardOpen(true);
      } else {
        setShowPanelSetupDialog(true);
      }
    } catch (_) {
      if (effectiveRole === 'student') {
        const studentGrade = currentUser?.grade || 'Grade 10';
        const studentSec = currentUser?.section || 'Astra';
        setPanelBoardRegistration({
          id: `student_panel_${currentUser?.uid || 'guest'}`,
          school_id: 'default_school',
          class_id: studentGrade,
          section_id: studentSec,
          display_name: `${studentGrade} (${studentSec}) Classroom Board`,
          registered_by: currentUser?.uid || 'student',
          status: 'active',
          device_token: 'student_view_token',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        setIsPanelBoardOpen(true);
      } else {
        setShowPanelSetupDialog(true);
      }
    }
  };

  const isTabAllowedInPresentation = (tab: string) => {
    return ['whiteboard', 'ai_teacher', 'materials', 'assignments', 'homework', 'pomodoro', 'planner', 'tasks', 'flashcards', 'study_hub'].includes(tab);
  };

  const isSidebarTabActive = (tab: string) => {
    return tab === 'study_hub'
      ? ['study_hub', 'tasks', 'planner', 'flashcards'].includes(activeTab)
      : tab === 'brain_battle' || tab === 'quiz'
      ? ['brain_battle', 'quiz'].includes(activeTab)
      : activeTab === tab;
  };

  const getSidebarBtnClass = (tab: string, type: 'standard' | 'faculty' | 'attendance' | 'admin' = 'standard') => {
    const isActive = isSidebarTabActive(tab);
    let base = `group relative w-full flex items-center transition-all duration-150 rounded-xl border text-left min-w-0 cursor-pointer ${
      sidebarOpen ? 'gap-3 px-3 py-2' : 'md:justify-center md:px-0 md:py-2 gap-3 px-3 py-2'
    } `;
    if (smartBoardMode) {
      base += `text-xs sm:text-sm font-bold `;
    } else {
      base += `text-xs font-medium `;
    }

    if (isActive) {
      if (type === 'faculty') base += 'bg-emerald-600 text-white shadow-sm border-emerald-500 font-semibold';
      else if (type === 'attendance') base += 'bg-amber-600 text-white shadow-sm border-amber-500 font-semibold';
      else if (type === 'admin') base += 'bg-rose-600 text-white shadow-sm border-rose-500 font-semibold';
      else base += 'bg-blue-600 text-white shadow-sm border-blue-500 font-semibold';
    } else {
      base += 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border-transparent';
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
    if (!['study_hub', 'tasks', 'planner', 'flashcards'].includes(tab)) {
      setSelectedFlashcardDeckId(null);
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
  const vaultNotesRef = useRef<VaultNote[]>(vaultNotes);
  useEffect(() => {
    vaultNotesRef.current = vaultNotes;
  }, [vaultNotes]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteEditMode, setNoteEditMode] = useState<boolean>(true);
  const [noteFont, setNoteFont] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [notesAiModalOpen, setNotesAiModalOpen] = useState<boolean>(false);
  const [notesAiModalMode, setNotesAiModalMode] = useState<'create' | 'edit'>('create');
  const [notesAiSelectedText, setNotesAiSelectedText] = useState<string>('');

  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [connectedAssessments, setConnectedAssessments] = useState<any[]>([]);

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
      const updated = { ...note, collabCode, isCollab: true, permission: note.permission || 'edit' };
      setVaultNotes(prev => prev.map(n => n.id === note.id ? updated : n));
      await saveVaultNoteToSupabase(updated, currentUser?.uid);
    }
    subscribeRealtimeEvents(`lecture_collab_${note.id}`, {});
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
        // Subscribe realtime channel immediately before editing
        subscribeRealtimeEvents(`lecture_collab_${found.id}`, {});
        await saveVaultNoteToSupabase(found, currentUser?.uid);
        
        setVaultNotes(prev => {
          const idx = prev.findIndex(n => n.id === found.id || n.collabCode === cleanCode);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...found };
            return copy;
          }
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
  const [orionInitialQuery, setOrionInitialQuery] = useState<string>('');
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
  // Removed redundant task states
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

  const byteThreadContext = useContextHoldMenu<string>();
  const aiThreadHoldMenu = byteThreadContext.menu ? { threadId: byteThreadContext.menu.itemId, x: byteThreadContext.menu.x, y: byteThreadContext.menu.y } : null;
  const setAiThreadHoldMenu = (val: { threadId: string; x: number; y: number } | null) => {
    if (val) {
      byteThreadContext.openMenu(val.threadId, val.x, val.y, false);
    } else {
      byteThreadContext.closeMenu();
    }
  };
  const byteThreadMenuRef = useRef<HTMLDivElement | null>(null);
  const [byteDeleteConfirmId, setByteDeleteConfirmId] = useState<string | null>(null);
  const [renamingByteThread, setRenamingByteThread] = useState<{ threadId: string; title: string } | null>(null);

  useDismissContextMenu(
    Boolean(byteThreadContext.menu),
    () => {
      byteThreadContext.closeMenu();
      setByteDeleteConfirmId(null);
    },
    byteThreadMenuRef,
    byteThreadContext.isInteractionGuarded
  );

  const handlePinThread = (threadId: string) => {
    let toggledThread: any = null;
    setAiThreads(prev => {
      const updated = prev.map(t => {
        if (t.id !== threadId) return t;
        toggledThread = { ...t, isPinned: !t.isPinned };
        return toggledThread;
      });
      return updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    });
    if (toggledThread && currentUser?.uid) {
      void saveAiBuddyChat({ ...toggledThread, userId: currentUser.uid }).catch(() => {});
    }
    showNotification(toggledThread?.isPinned ? '📌 Chat session pinned.' : 'Chat session unpinned.');
    setByteDeleteConfirmId(null);
    setAiThreadHoldMenu(null);
  };

  const handleRenameThread = async (threadId: string) => {
    const thread = aiThreads.find(t => t.id === threadId);
    if (!thread) return;
    setRenamingByteThread({ threadId, title: thread.title || '' });
    setByteDeleteConfirmId(null);
    setAiThreadHoldMenu(null);
  };

  const handleConfirmRenameByteThread = async () => {
    if (!renamingByteThread) return;
    const newTitle = renamingByteThread.title.trim();
    if (!newTitle) return;
    const { threadId } = renamingByteThread;
    setAiThreads(prev => prev.map(t => t.id === threadId ? { ...t, title: newTitle } : t));
    if (currentUser?.uid) {
      await renameAiBuddyChat(threadId, newTitle, currentUser.uid);
    }
    showNotification('✓ Session renamed.');
    setRenamingByteThread(null);
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
    const syncQuota = () => {
      fetchAIUsageStatus(currentUser?.uid || 'guest', effectiveRole || 'student').then(setAiUsageState);
    };
    syncQuota();

    const handleQuotaEvent = (e: any) => {
      if (e.detail) setAiUsageState(e.detail);
    };
    window.addEventListener('s_os_ai_quota_updated', handleQuotaEvent);
    window.addEventListener('veylentra-winter-updated', syncQuota);
    return () => {
      window.removeEventListener('s_os_ai_quota_updated', handleQuotaEvent);
      window.removeEventListener('veylentra-winter-updated', syncQuota);
    };
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

  // Byte & Orion Assistant Selector Modal
  const [isByteOrionModalOpen, setIsByteOrionModalOpen] = useState<boolean>(false);
  const [byteOrionModalMode, setByteOrionModalMode] = useState<'select' | 'byte' | 'orion'>('select');
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
  const [activeDragNoteId, setActiveDragNoteId] = useState<string | null>(null);

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

  // Canonical notification deep-link execution once auth/session is restored and workspace is unlocked
  applyNotificationNavigationRef.current = (intent: NotificationNavIntent) => {
    const resolved = resolveNotificationDestination(intent, effectiveRole || currentUser?.role);

    if (resolved.subTab) {
      setStudyHubSubTab(resolved.subTab);
    }

    if (presentationMode && !isTabAllowedInPresentation(resolved.tab)) {
      setShowNotifCenter(true);
      showNotification('🔒 Destination restricted in Presentation Mode.');
      stripNotificationParamsFromUrl();
      return;
    }

    if (!['study_hub', 'tasks', 'planner', 'flashcards'].includes(resolved.tab)) {
      setSelectedFlashcardDeckId(null);
    }

    setActiveTab(resolved.tab);
    try {
      localStorage.setItem('s_os_active_tab', resolved.tab);
    } catch (_) {}

    if (resolved.tab === 'whats_new') {
      window.history.pushState(null, '', '/whats-new');
    } else if (typeof window !== 'undefined' && (window.location.pathname === '/whats-new' || window.location.pathname === '/whats_new')) {
      window.history.pushState(null, '', '/');
    }

    if (resolved.openNotificationCenter) {
      setShowNotifCenter(true);
    }

    if (resolved.notifId && currentUser?.uid && currentUser.uid !== 'usr_guest') {
      void handleMarkAsRead(resolved.notifId);
    }

    if (intent.action === 'accept' && resolved.callId) {
      acceptSchoolCall(resolved.callId, currentUser);
    } else if (intent.action === 'decline' && resolved.callId) {
      declineSchoolCall(resolved.callId, 'declined_via_sw', currentUser);
    }

    stripNotificationParamsFromUrl();
  };

  useEffect(() => {
    const isReady = Boolean(currentUser && !firebaseLoading && !dataLoading && !isLocked);
    authReadyForNavRef.current = isReady;
    if (!isReady) return;

    const pending = consumePendingNotificationIntent();
    const fromLocation =
      typeof window !== 'undefined'
        ? parseNotificationIntentFromLocation(window.location.search, window.location.hash)
        : null;
    const intentToApply = pending || fromLocation;
    if (intentToApply) {
      applyNotificationNavigationRef.current(intentToApply);
    }
  }, [currentUser?.uid, effectiveRole, firebaseLoading, dataLoading, isLocked]);

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
        name: 'Aarav Sharma',
        email: 'student@demo.com',
        role: 'student' as const,
        grade: 'Grade 10',
        section: 'Ruby' as any,
        house: 'Ruby' as any,
        studyHours: 14,
        quizzesTaken: 5,
        streakDays: 0,
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
        if (
          event === 'TOKEN_REFRESHED' &&
          session?.user?.id &&
          currentUserRef.current?.uid &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          void requestFCMPermission(
            currentUserRef.current.uid,
            {
              role: currentUserRef.current.role || 'student',
              grade: currentUserRef.current.grade || '',
              section: currentUserRef.current.section || '',
              house: currentUserRef.current.house || '',
              schoolId: (currentUserRef.current as any)?.schoolId || 'default_school',
            },
            { silentIfDefault: true }
          );
        }
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

  // Active Collaborative Note Realtime Synchronization (for Cross-Account & Cross-Device edits)
  useEffect(() => {
    if (!selectedNoteId || activeTab !== 'notes') return;
    const activeNote = vaultNotes.find(n => n.id === selectedNoteId);
    if (!activeNote || !activeNote.collabCode) return;

    const channelName = `lecture_collab_${activeNote.id}`;
    const unsubscribe = subscribeRealtimeEvents(channelName, {
      note_content_changed: (payload: any) => {
        if (!payload || payload.senderUid === currentUser?.uid) return;
        setVaultNotes(prev => prev.map(n => {
          if (n.id === activeNote.id) {
            return {
              ...n,
              content: typeof payload.content === 'string' ? payload.content : n.content,
              title: payload.title || n.title,
              subject: payload.subject || n.subject
            };
          }
          return n;
        }));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedNoteId, activeTab, currentUser?.uid, vaultNotes]);

  // Homework Persistence Sync (Staggered)
  const isHomeworkLoaded = useRef<boolean>(false);

  useEffect(() => {
    if (!currentUser) {
      isHomeworkLoaded.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const apiRes = await fetchAssignments(currentUser);
        if (apiRes.ok && apiRes.data && apiRes.data.length > 0) {
          setHomeworkList(apiRes.data);
          isHomeworkLoaded.current = true;
        } else {
          const list = await getSupabaseHomework();
          if (list && list.length > 0) {
            setHomeworkList(list);
          } else {
            setHomeworkList([
              { id: 'hw-1', title: 'Physics Worksheets Chapter 4', subject: 'Physics', content: 'Solve problems 1-15 regarding circular friction.', dueDate: 'Tomorrow', classGrade: 'Grade 10', classSection: 'All Sections', givenBy: 'Prof. Elara', createdAt: new Date().toISOString(), completedList: [] },
              { id: 'hw-2', title: 'C++ BST balancing questions', subject: 'Computer Science', content: 'Design pseudo-code for rotation of tree node structures.', dueDate: 'Friday', classGrade: 'Grade 10', classSection: 'All Sections', givenBy: 'Prof. Elara', createdAt: new Date().toISOString(), completedList: ['naitik.kashyap0015@gmail.com'] }
            ]);
          }
          isHomeworkLoaded.current = true;
        }
      } catch (_) {
        const list = await getSupabaseHomework();
        if (list && list.length > 0) setHomeworkList(list);
        isHomeworkLoaded.current = true;
      }

      fetchAssessments(currentUser)
        .then(res => {
          if (res.ok && res.data) {
            setConnectedAssessments(res.data);
          }
        })
        .catch(() => {});
    }, 500);

    return () => clearTimeout(timer);
  }, [currentUser]);

  // Realtime Supabase & Local Custom Event Sync for Orion Automations & Global Broadcasts
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    setNotifications([]);

    const refreshNotifications = async () => {
      try {
        const list = await getAppNotifications(currentUser.uid, currentUser.grade, currentUser.section, effectiveRole);
        if (list) {
          setNotifications(list);
        }
        // Role-strict learning reminders (Students only)
        ReminderService.checkAndDispatchLearningReminders(currentUser.uid, currentUser.name, {
          role: effectiveRole || currentUser.role,
          notificationPreferences: (currentUser as any)?.raw_data?.notificationPreferences,
        }).catch(() => {});
      } catch (e) {
        console.warn('[App] Error refreshing notifications:', e);
      }
    };

    refreshNotifications();

    const handleDbUpdate = (e: any) => {
      const { table } = e.detail || {};
      if (table === 'homework' || table === 'assignment_submissions' || !table) {
        fetchAssignments(currentUser).then(res => {
          if (res.ok && res.data && res.data.length > 0) {
            setHomeworkList(res.data);
          } else {
            getSupabaseHomework().then(list => {
              if (list && list.length > 0) setHomeworkList(list);
            });
          }
        });
      }
      if (table === 'gradebook_assessments' || !table) {
        fetchAssessments(currentUser).then(res => {
          if (res.ok && res.data) setConnectedAssessments(res.data);
        }).catch(() => {});
      }
      if (table === 'announcements' || !table) {
        fetchTargetedAnnouncements(currentUser).then(res => {
          if (res.ok && res.data) {
            setAnnouncements(res.data.filter(a => isAnnouncementEligibleForUser(a, currentUser)));
          }
        }).catch(() => {});
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
          if (row && currentUser && isUserEligibleForNotification(row, { ...currentUser, role: effectiveRole })) {
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
          refreshNotifications();
          const notif = payload?.payload;
          if (notif && currentUser && isUserEligibleForNotification(notif, { ...currentUser, role: effectiveRole })) {
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
        const { data: posts } = await supabase
          .from('feedback_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (posts && posts.length > 0) {
          const mapped: FeedbackPost[] = posts.map((p: any) => ({
            id: p.id,
            author: p.user_name || p.author || 'Veylentra Member',
            authorId: p.user_id || p.author_id || 'anonymous',
            role: p.user_role || p.role || 'student',
            text: p.body || p.text || '',
            title: p.title || 'Campus Suggestion',
            votes: typeof p.votes === 'number' ? p.votes : 1,
            upvotedBy: Array.isArray(p.upvoted_by) ? p.upvoted_by : [],
            replies: Array.isArray(p.replies) ? p.replies : [],
            category: p.category || 'suggestion',
            status: p.status || 'open',
            createdAt: p.created_at || new Date().toISOString()
          }));
          setFeedbackPosts(mapped);
          return;
        }

        const { data } = await supabase.from('global_data').select('*').eq('id', '__global_feedbacks__').maybeSingle();
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

  // Announcements Sync (prefers targeted cohort-scoped announcements with global fallback)
  useEffect(() => {
    if (!currentUser || activeTab !== 'dashboard') return;
    const loadAnnouncements = async () => {
      try {
        const apiRes = await fetchTargetedAnnouncements(currentUser);
        if (apiRes.ok && apiRes.data && apiRes.data.length > 0) {
          setAnnouncements(apiRes.data.filter(a => isAnnouncementEligibleForUser(a, currentUser)));
          return;
        }
        const { data } = await supabase.from('global_data').select('*').eq('id', '__global_announcements__').maybeSingle();
        if (data && data.content) {
          const parsed = JSON.parse(data.content);
          setAnnouncements(Array.isArray(parsed) ? parsed.filter(a => isAnnouncementEligibleForUser(a, currentUser)) : []);
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
            if (!isAnnouncementEligibleForUser(data.announcement, currentUser)) break;
            setAnnouncements(prev => {
              if (prev.some(a => a.id === data.announcement.id)) return prev;
              return [data.announcement, ...prev];
            });
            showNotification(`📢 NEW ANNOUNCEMENT: ${data.announcement.title}`);
            break;

          case 'homework:received':
            if (effectiveRole === 'student') {
              if (data.homework?.status === 'draft' || data.homework?.status === 'archived') break;
              if (!isStudentMatchedToCohort(currentUser?.grade, currentUser?.section, data.homework?.classGrade, data.homework?.classSection)) break;
            }
            setHomeworkList(prev => {
              if (prev.some(h => h.id === data.homework.id)) return prev;
              return [data.homework, ...prev];
            });
            showNotification(`📝 New Homework Released: ${data.homework.title}`);
            break;

          case 'homework:updated':
            if (effectiveRole === 'student' && (data.homework?.status === 'draft' || data.homework?.status === 'archived')) {
              setHomeworkList(prev => prev.filter(h => h.id !== data.homework.id));
              break;
            }
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

      // 2. If Supabase Auth failed, attempt signUp to check/establish session
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

      // 3. Fallback to Supabase user_profiles table database lookup
      if (!authenticated) {
        const profile = await getSupabaseUserProfile(undefined, loginEmail.trim(), true);
        if (profile) {
          let pwdMatch = true;
          if (profile.raw_data?.password_hash) {
            const enteredHash = await hashPassword(loginPassword);
            if (profile.raw_data.password_hash !== enteredHash) {
              pwdMatch = false;
            }
          }
          if (pwdMatch) {
            authenticated = true;
            setCurrentUser(profile);
            localStorage.setItem('s_os_user', JSON.stringify(profile));
            updateRecentAccounts(profile);
            try {
              sessionStorage.removeItem('s_os_startup_shown');
            } catch (_) {}
            setShowStartup(true);
            setFirebaseLoading(false);
            if (profile.role === 'parent') {
              setActiveTab('parent_portal');
            }
            showNotification(`Welcome back, ${profile.name}! ✅`);
            return;
          } else {
            throw new Error('Incorrect password. Please verify your credentials.');
          }
        } else {
          throw new Error('No registered account found with this email. Please create an account.');
        }
      }

      if (authUser) {
        let profile = await getSupabaseUserProfile(authUser.id, authUser.email);
        if (!profile) {
          profile = {
            uid: authUser.id,
            name: authUser.user_metadata?.full_name || loginEmail.split('@')[0] || 'User',
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
        if (profile.role === 'parent') {
          setActiveTab('parent_portal');
        }
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
    
    if (!regName.trim() || regName.trim().length < 2) {
      showNotification('Full name must be at least 2 characters.');
      return;
    }

    if (regRole !== 'parent' && !regBirthdate) {
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

      try {
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
          console.warn('[Supabase Auth Signup Notice]:', authError.message);
        } else {
          authData = data;
          if (authData && authData.user) {
            setLinkedGoogleUid(authData.user.id);
            actualUid = authData.user.id;
          }
        }
      } catch (authException) {
        console.warn('[Supabase Auth Signup Exception]:', authException);
      }
    }

    const statusMap: Record<string, string> = {
      student: 'approved',
      parent: 'approved',
      teacher: 'pending_teacher',
      coordinator: 'pending_coordinator',
      admin: 'pending_admin'
    };

    const isWhitelisted = finalEmail && [
      'naitik.kashyap0015@gmail.com',
      'naitik.kashyap5205@gmail.com'
    ].includes(finalEmail.toLowerCase());

    const status = isWhitelisted ? 'approved' : regRole === 'parent' ? 'approved' : (statusMap[regRole] || 'approved');
    const uid = actualUid || `manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newProfile: any = {
      uid: uid,
      name: regName.trim(),
      email: finalEmail,
      photoURL: regPhoto.trim() || linkedGooglePhoto || '',
      role: isWhitelisted ? 'super_admin' : regRole === 'parent' ? 'parent' : 'student',
      requestedRole: isWhitelisted ? 'admin' : regRole,
      accountStatus: status,
      phone: regPhone.trim(),
      birthdate: regRole === 'parent' ? '' : regBirthdate,
      studyHours: 8,
      quizzesTaken: 2,
      streakDays: 0,
      lastLogin: Date.now(),
      raw_data: {
        password_hash: passwordHash,
        phone: regPhone.trim()
      }
    };

    if (regRole === 'student') {
      newProfile.grade = regGrade;
      newProfile.section = regSection;
      newProfile.house = regHouse;
    } else if (regRole === 'parent') {
      newProfile.role = 'parent';
      newProfile.requestedRole = 'parent';
      newProfile.accountStatus = 'approved';
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
      } else if (regRole === 'parent') {
        showNotification(`Welcome to Veylentra Family Portal, ${newProfile.name}!`);
        setActiveTab('parent_portal');
      } else {
        showNotification(`Request submitted for ${regRole.toUpperCase()} approval. Exploring in the meantime!`);
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
      clearSupabaseUserProfileCache();
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

  // Task handlers moved to StudyHubTaskManager

  // Vault Notes notes state
  const handleSaveNote = async () => {
    if (!(newNoteTitle || '').trim() || !(newNoteContent || '').trim() || !currentUser) {
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
      void recordEngagementActivity(currentUser, effectiveRole || 'student', 'study_session', 1, {
        title: 'Study notes updated',
        subtitle: 'Saved lecture notes in your vault.',
        ctaLabel: 'Open Lecture Notes',
        actionTab: 'notes',
        reason: 'Saved lecture note',
      });
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

  const handleSaveAiNewNote = async (title: string, subject: string, content: string) => {
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
      title: title || 'AI Lecture Note',
      subject: subject || 'Syllabus General',
      content,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      icon: defaultIcon,
      coverBg: defaultCover,
      userId: uid,
      folder_id: activeVaultFolderId || null
    };
    try {
      const updated = [newNote, ...vaultNotes];
      setVaultNotes(updated);
      setSelectedNoteId(newId);
      setNoteEditMode(true);
      await saveVaultNoteToSupabase(newNote, uid);
      awardStudentXP(currentUser, 'create_note', { uniqueItemId: newId });
      void recordEngagementActivity(currentUser, effectiveRole || 'student', 'study_session', 1, {
        title: 'AI lecture note saved',
        subtitle: `Saved "${newNote.title}" in Lecture Notes.`,
        ctaLabel: 'Open Lecture Notes',
        actionTab: 'notes',
        reason: 'Saved AI lecture note',
      });
      showNotification(`✨ Lecture Note "${newNote.title}" saved to Vault!`);
    } catch (err: any) {
      console.error('Error saving AI note:', err);
      showNotification(`✨ Note saved to local workspace.`);
    }
  };

  const handleApplyAiEdit = async (newContent: string) => {
    const activeNote = vaultNotes.find(n => n.id === selectedNoteId);
    if (!activeNote || !currentUser) return;
    const updatedNote: VaultNote = {
      ...activeNote,
      content: newContent
    };
    const updatedNotes = vaultNotes.map(n => n.id === activeNote.id ? updatedNote : n);
    setVaultNotes(updatedNotes);
    try {
      await saveVaultNoteToSupabase(updatedNote, currentUser.uid);
      void recordEngagementActivity(currentUser, effectiveRole || 'student', 'study_session', 1, {
        title: 'Lecture note refined',
        subtitle: `Updated "${activeNote.title}" with Byte edits.`,
        ctaLabel: 'Open Lecture Notes',
        actionTab: 'notes',
        reason: 'Updated lecture note',
      });
      showNotification(`✨ Note "${activeNote.title}" updated with AI changes.`);
    } catch (err: any) {
      console.error('Error updating note:', err);
      showNotification('Note updated in local workspace.');
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

    // 2. Clear role simulation overrides & chat/AI/user caches so new user's data loads cleanly
    setSimulatedRole(null);
    setIsSuperAdmin(matched.role === 'super_admin');
    aiChatsSyncingFor.current = null;
    clearChatCache();
    clearSupabaseUserProfileCache();
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
      streakDays: 0,
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
    window.dispatchEvent(new CustomEvent('studentos-gamification-updated'));
    window.dispatchEvent(new CustomEvent('veylentra-winter-updated'));

    setTasks(nextProfile.raw_data?.tasks || []);
    setSchedules(nextProfile.raw_data?.schedules || []);
    setSavedMaterialIds(nextProfile.raw_data?.savedMaterialIds || []);

    // 5. Adjust activeTab if needed for the new account's role
    if (matched.role === 'parent') {
      setActiveTab('parent_portal');
    } else if (activeTab === 'parent_portal') {
      setActiveTab('dashboard');
    } else if (activeTab === 'faculty' && !isFacultyRole(matched.role)) {
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
        comments: []
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
      void recordEngagementActivity(currentUser, effectiveRole || 'student', 'quiz', 1, {
        title: 'Practice Quiz Completed',
        subtitle: `Scored ${quizScore}/${questions.length} in ${quizSubject}.`,
        ctaLabel: 'Open Study Hub',
        actionTab: 'study_hub',
        reason: 'Completed practice quiz',
      });
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

  const handleSaveToNotes = (text: string, customTitle?: string) => {
    const cleanSubject = currentUser?.specialtySubject || 'AI Study';
    const firstLine = text.split('\n').find(l => l.trim().length > 0) || '';
    const cleanedFirstLine = firstLine.replace(/^[#>*\-\s`]+/, '').trim();
    const fallbackSnippet = cleanedFirstLine.length > 42 ? cleanedFirstLine.slice(0, 42).trim() + '...' : cleanedFirstLine;
    const finalTitle = (customTitle && customTitle.trim()) || (fallbackSnippet ? `Byte Note — ${fallbackSnippet}` : `AI Study Note - ${new Date().toLocaleDateString()}`);

    const newNote: VaultNote = {
      id: generateUniqueId(),
      title: finalTitle,
      subject: cleanSubject,
      content: text,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
    
    setVaultNotes(prev => [newNote, ...prev]);
    showNotification(`Saved "${finalTitle}" to your Personal Vault Notes!`);
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

    const targetThreadId = activeThreadId || `thread_${Date.now()}`;
    let currentThread = aiThreads.find(t => t.id === targetThreadId) || aiThreads[0];
    
    if (!currentThread) {
      const defaultTitle = userQuery.length > 25 ? userQuery.substring(0, 25) + '...' : userQuery;
      currentThread = {
        id: targetThreadId,
        title: defaultTitle,
        personaId: (selectedPersona as any)?.id || 'byte',
        mode: (aiMode as any) || 'explanatory',
        createdAt: Date.now(),
        messages: []
      };
      setActiveThreadId(targetThreadId);
    }

    const existingTitle = currentThread?.title || 'Study Session';
    const newTitle = (!existingTitle || existingTitle.startsWith('Study Session') || existingTitle.startsWith('Introductory Study') || existingTitle.startsWith('Study with'))
      ? (userQuery.length > 25 ? userQuery.substring(0, 25) + '...' : userQuery)
      : existingTitle;

    const updatedMessages = [...(currentThread?.messages || []), newUserMsg];

    // Optimistically push user message + streaming assistant placeholder (handling zero-threads state)
    setAiThreads(prev => {
      const exists = prev.some(t => t.id === targetThreadId);
      if (!exists) {
        return [
          {
            id: targetThreadId,
            title: newTitle,
            personaId: (selectedPersona as any)?.id || 'byte',
            mode: (aiMode as any) || 'explanatory',
            createdAt: Date.now(),
            messages: [...updatedMessages, { role: 'assistant' as const, content: '' }],
            attachedFiles: []
          },
          ...prev
        ];
      }
      return prev.map(t => {
        if (t.id === targetThreadId) {
          return { 
            ...t, 
            messages: [...updatedMessages, { role: 'assistant' as const, content: '' }],
            title: newTitle,
            attachedFiles: []
          };
        }
        return t;
      });
    });

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
      // Fetch role-authorized Veylentra context ONLY when query needs workspace/role data
      const { contextString: ragContext, hasStudentOSData, intentCategory } = await buildAuthorizedStudentOSContext(
        userQuery,
        currentUser,
        userRoleKey,
        { activeTab, localSnapshot: { vaultNotes } }
      );
      setAiGroundedInData(hasStudentOSData);

      const historyPayload = (currentThread?.messages || []).slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      let streamedWebSources: any[] = [];
      let streamedWebUsed = false;
      let webSearchContext = '';

      // Fix: Only trigger web search when genuinely requested and not a greeting/small talk
      const q = (userQuery || '').trim().toLowerCase();
      const isGreeting = /^(hey|hi|hello|hii|heyy|yo|sup|thanks|thank you|ok|okay|bye|good morning|good night|how are you|what's up|whats up)[!.?\s]*$/.test(q);
      const asksForSearch = /\b(search|look up|find online|current|latest|news|today|video|videos|who is|when did)\b/i.test(userQuery);
      const isWebSearchRequested = !isGreeting && asksForSearch && (aiWebSearchMode as string) !== 'off';
      if (isWebSearchRequested) {
        setAiStatusMessage('🔍 Searching verified web & academic sources...');
        try {
          const searchResp = await fetch('/api/ai/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: userQuery })
          });
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            if (searchData.success && Array.isArray(searchData.results) && searchData.results.length > 0) {
              streamedWebUsed = true;
              streamedWebSources = searchData.results.map((r: any) => ({
                title: r.title,
                url: r.url || r.uri,
                snippet: r.snippet || r.description,
                domain: r.published_source || r.domain || (r.url ? new URL(r.url).hostname : 'web')
              }));

              const formattedSources = streamedWebSources.map((s, idx) => `[Source ${idx + 1}]: ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet}`).join('\n\n');

              webSearchContext = `\n\nVERIFIED REAL-TIME WEB SEARCH RESULTS FOR "${userQuery}":
${formattedSources}

CRITICAL WEB GROUNDING DIRECTIVE:
1. Base your answer strictly on the real-time search results above.
2. Cite the exact titles and URLs provided in the search results.
3. NEVER state "I cannot browse the web" because live search results have been retrieved and provided to you above.
4. NEVER invent, fabricate, or hallucinate URLs or links. Only display links explicitly provided in the search results above.`;
            }
          }
        } catch (sErr) {
          console.warn('Direct web search pre-fetch failed, falling back to server router:', sErr);
        }
      }

      const streamResult = await streamAIChatClient(
        {
          prompt: promptWithContext + webSearchContext,
          history: historyPayload,
          persona: selectedPersona,
          level: currentUser?.grade,
          subject: currentUser?.specialtySubject || 'Science',
          mode: aiMode,
          ragContext: ragContext || undefined,
          userId: userIdKey,
          userRole: userRoleKey,
          activeTab,
          intentType: intentCategory,
          modelOverride: aiModelOverride || undefined,
          webSearchMode: isWebSearchRequested ? aiWebSearchMode : 'off',
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
            setAiThreads(prev => {
              const exists = prev.some(t => t.id === targetThreadId);
              const assistantMsg = {
                role: 'assistant' as const,
                content: fullText,
                webSearchUsed: streamedWebUsed,
                webSources: streamedWebSources
              };
              if (!exists) {
                return [{
                  id: targetThreadId,
                  title: newTitle,
                  personaId: (selectedPersona as any)?.id || 'byte',
                  mode: (aiMode as any) || 'explanatory',
                  createdAt: Date.now(),
                  messages: [...updatedMessages, assistantMsg]
                }, ...prev];
              }
              return prev.map(t => {
                if (t.id === targetThreadId) {
                  return {
                    ...t,
                    messages: [...updatedMessages, assistantMsg]
                  };
                }
                return t;
              });
            });
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
      void recordEngagementActivity(currentUser, effectiveRole || 'student', 'study_session', 1, {
        title: 'Byte AI Study Session',
        subtitle: 'Practiced concepts with Byte AI Mentor.',
        ctaLabel: 'Open AI Mentor',
        actionTab: 'ai_teacher',
        reason: 'Asked Byte study question',
      });

      if (streamResult.usage) {
        setAiUsageState(prev => ({
          ...prev,
          used: streamResult.usage.used,
          limit: streamResult.usage.limit,
          baseLimit: streamResult.usage.baseLimit ?? prev.baseLimit,
          bonus: streamResult.usage.bonus ?? prev.bonus,
          winterBonus: streamResult.usage.winterBonus ?? prev.winterBonus,
          voucherBonus: streamResult.usage.voucherBonus ?? prev.voucherBonus,
          remaining: streamResult.usage.remaining,
          nextAvailableInMinutes: streamResult.usage.nextAvailableInMinutes,
          lastUpdated: Date.now()
        }));
      } else {
        const updated = recordLocalMessage(userIdKey, userRoleKey);
        setAiUsageState(updated);
      }

      setAiThreads(prev => {
        const assistantMsg = {
          role: 'assistant' as const,
          content: answer,
          webSearchUsed: finalWebUsed,
          webSources: finalWebSources
        };
        const exists = prev.some(t => t.id === targetThreadId);
        if (!exists) {
          return [{
            id: targetThreadId,
            title: newTitle,
            personaId: (selectedPersona as any)?.id || 'byte',
            mode: (aiMode as any) || 'explanatory',
            createdAt: Date.now(),
            messages: [...updatedMessages, assistantMsg]
          }, ...prev];
        }
        return prev.map(t => {
          if (t.id === targetThreadId) {
            return {
              ...t,
              messages: [...updatedMessages, assistantMsg]
            };
          }
          return t;
        });
      });

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
        setAiThreads(prev => prev.map(t => {
          if (t.id === targetThreadId) {
            const msgs = t.messages.filter(m => m.content !== '');
            return { ...t, messages: msgs.length > 0 ? msgs : [...updatedMessages, { role: 'assistant', content: '[Generation stopped by user]' }] };
          }
          return t;
        }));
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

      setAiThreads(prev => {
        const assistantErrMsg = { role: 'assistant' as const, content: errorContent };
        const exists = prev.some(t => t.id === targetThreadId);
        if (!exists) {
          return [{
            id: targetThreadId,
            title: newTitle,
            personaId: (selectedPersona as any)?.id || 'byte',
            mode: (aiMode as any) || 'explanatory',
            createdAt: Date.now(),
            messages: [...updatedMessages, assistantErrMsg]
          }, ...prev];
        }
        return prev.map(t => {
          if (t.id === targetThreadId) {
            return { 
              ...t, 
              messages: [...updatedMessages, assistantErrMsg] 
            };
          }
          return t;
        });
      });
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

  const viewProps = {
    isDemoMode,
    currentUser,
    currentUserRef,
    firebaseLoading,
    dataLoading,
    firebaseOnboardingUser,
    authError,
    applyNotificationNavigationRef,
    authReadyForNavRef,
    DEV_MODE,
    simulatedRole,
    isSuperAdmin,
    effectiveRole,
    isSportsTeacher,
    isSoundSettingsModalOpen,
    leaderboardTabView,
    studentLbAccess,
    facultyLbAccess,
    winterThemeAccess,
    winterTasksAccess,
    winterBadgesAccess,
    winterSantaAccess,
    lastNoteEngagementAtRef,
    winterSpinAccess,
    isFacultyRoleForLb,
    canViewLeaderboardTab,
    canViewWinterHub,
    sidebarWinterCosmetics,
    isOnboardingModalOpen,
    isProductTourOpen,
    activeTab,
    whatsNewUnreadCount,
    dueCardsCount,
    studyHubSubTab,
    selectedAdminSubTab,
    selectedFlashcardDeckId,
    assignmentSearchQuery,
    sidebarOpen,
    sidebarSearchQuery,
    collapsedSidebarSections,
    accountSwitcherExpanded,
    toggleSidebarSection,
    clock,
    hwFilterGrade,
    hwSearch,
    hwFormOpen,
    hwEditId,
    hwFSubject,
    hwFTitle,
    hwFContent,
    hwFGrade,
    hwFSection,
    profileTab,
    notifications,
    showNotifCenter,
    requestedAccountType,
    regStep,
    resetToken,
    newResetPassword,
    confirmResetPassword,
    isResettingPassword,
    regStepRef,
    regRole,
    regName,
    regNameError,
    regPhone,
    regPhoneError,
    regBirthdate,
    regBirthdateError,
    regEmail,
    regPassword,
    loginEmail,
    loginPassword,
    regGrade,
    regSection,
    regHouse,
    regPhoto,
    regDept,
    regSubjects,
    regDesignation,
    isGoogleLinked,
    linkedGoogleUid,
    linkedGooglePhoto,
    showStartup,
    loadingProgress,
    loadingStep,
    presentationMode,
    smartBoardMode,
    isLocked,
    isSecurityChecking,
    hasPinConfigured,
    securityStatusError,
    isLockingWorkspace,
    isUnlocking,
    isSavingPin,
    isVerifyingPin,
    currentPinInput,
    autoLockTime,
    lastActivity,
    securityMenuOpen,
    pinSetupOpen,
    newPin,
    confirmPin,
    pinError,
    pinVerifyOpen,
    verifyPinInput,
    pinVerifyAction,
    lockScreenPinInput,
    lockScreenError,
    useKeyMode,
    isPanelBoardOpen,
    showPanelSetupDialog,
    panelBoardRegistration,
    inAppViewerDoc,
    handleOpenPanelBoard,
    isTabAllowedInPresentation,
    isSidebarTabActive,
    getSidebarBtnClass,
    handleSavePin,
    handleVerifyPin,
    triggerPinVerification,
    handleUnlockWithPin,
    handleLockWorkspace,
    handleTabSelect,
    lightMode,
    fontSize,
    highContrast,
    ttsEnabled,
    tasks,
    schedules,
    vaultNotes,
    vaultNotesRef,
    selectedNoteId,
    noteEditMode,
    noteFont,
    notesAiModalOpen,
    notesAiModalMode,
    notesAiSelectedText,
    homeworkList,
    connectedAssessments,
    vaultFolders,
    activeVaultFolderId,
    vaultItemHoldMenu,
    showVaultFolderModal,
    newVaultFolderName,
    renameVaultFolderModal,
    renameVaultInput,
    materialFolders,
    activeMaterialFolderId,
    showMaterialFolderModal,
    newMaterialFolderName,
    renameMaterialFolderModal,
    renameMaterialInput,
    materialItemHoldMenu,
    collabJoinModalOpen,
    collabJoinCodeInput,
    collabJoinError,
    collabJoinLoading,
    activeNoteCollabModalOpen,
    showNoteOutline,
    slashMenuOpen,
    slashMenuFilter,
    autoSaveState,
    viewSplitPreview,
    handlePinVaultNote,
    handleRenameVaultNote,
    handleShareVaultNote,
    handleRenameVaultFolder,
    handleDeleteVaultFolder,
    handleMoveVaultNoteToFolder,
    handleDeleteVaultNote,
    handleCreateMaterialFolder,
    handleRenameMaterialFolder,
    handleDeleteMaterialFolder,
    handleMoveMaterialToFolder,
    handleOpenNoteCollab,
    handleJoinNoteByCode,
    socketRef,
    lastXRef,
    lastYRef,
    holdTimerRef,
    startXRef,
    startYRef,
    whiteboardHistory,
    whiteboardRedoStack,
    aiChatsSyncingFor,
    announcements,
    aiGeneratingNotes,
    aiCustomPrompt,
    isSmartBoardPanelMode,
    isJarvisActive,
    orionInitialQuery,
    canvasShape,
    newMaterialIsPublic,
    newMaterialVisibility,
    newMaterialGrades,
    newMaterialSections,
    newMaterialHouses,
    materialsSearchQuery,
    materialsSubjectFilter,
    selectedMaterialForAi,
    aiActionLoading,
    aiActionResultText,
    aiActionType,
    aiUserQuestion,
    activeMaterialSubTab,
    materialsGradeFilter,
    materialsTypeFilter,
    materialsSortBy,
    openUploadModal,
    activeCommentsMaterialId,
    newCommentText,
    savedMaterialIds,
    activeChatTargetId,
    chatSearchQuery,
    previewMaterial,
    shareMaterial,
    showChatSidebarMobile,
    lessons,
    materials,
    feedbackPosts,
    students,
    isBroadcastModalOpen,
    notesViewMode,
    chats,
    chatRooms,
    isCreatingRoom,
    newRoomName,
    showGroupSettings,
    newRoomType,
    newRoomIcon,
    newRoomDescription,
    housePoints,
    authRole,
    authName,
    authEmail,
    authGrade,
    authSection,
    authHouse,
    authSpecialty,
    authRollNumber,
    authDepartment,
    authSubjects,
    authDesignation,
    authPin,
    recentAccounts,
    securityVerificationAcc,
    pinVerificationError,
    enteredVerificationPin,
    isPinModalOpen,
    newNoteTitle,
    newNoteContent,
    newNoteSubject,
    newMaterialTitle,
    newMaterialDesc,
    newMaterialSubject,
    newMaterialType,
    newFeedbackText,
    newFeedbackCategory,
    newChatText,
    joinRoomCode,
    themeMode,
    selectedPersona,
    aiInput,
    aiLoading,
    aiMode,
    aiThreads,
    activeThreadId,
    byteThreadContext,
    aiThreadHoldMenu,
    setAiThreadHoldMenu,
    byteThreadMenuRef,
    byteDeleteConfirmId,
    renamingByteThread,
    handlePinThread,
    handleRenameThread,
    handleConfirmRenameByteThread,
    activeThread,
    attachedFiles,
    speakingMsgIdx,
    aiActiveModelLabel,
    aiGroundedInData,
    aiWebSearchMode,
    aiModelOverride,
    aiStatusMessage,
    aiAbortControllerRef,
    aiUsageState,
    showQuotaModal,
    showAiHistoryDrawer,
    selectedTopicForTutor,
    aiReasoningMode,
    showScrollBottomBtn,
    aiFileInputRef,
    whiteboardRef,
    isDrawingRef,
    brushColor,
    recentColors,
    brushSize,
    canvasTool,
    canvasMode,
    whiteboardSlides,
    currentSlideIndex,
    quizSubject,
    quizStarted,
    isByteOrionModalOpen,
    byteOrionModalMode,
    quizCurrentIndex,
    quizSelectedOption,
    quizSubmitted,
    quizScore,
    quizTimer,
    quizTimerRef,
    studentJoinedClass,
    activeBroadcast,
    understandingSignals,
    quickUploadDragActive,
    quickUploadFile,
    quickUploadTitle,
    quickUploadSubject,
    quickUploadType,
    quickUploadIsUploading,
    pomodoroSeconds,
    customPomodoro,
    pomodoroRunning,
    pomodoroMode,
    pomodoroCompletedCount,
    pomodoroJustCompleted,
    showPomodoroSettings,
    timerH,
    timerM,
    timerS,
    pomodoroIntervalRef,
    pomodoroEndTimeRef,
    pomodoroCompletionGuardRef,
    showLoginPassword,
    hwStatusFilter,
    activeDragNoteId,
    schSubject,
    schTime,
    schDay,
    profileNameInput,
    profileNameError,
    profileGradeInput,
    profileSectionInput,
    profileHouseInput,
    profileAvatar,
    getNotificationEmoji,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDeleteNotif,
    toasts,
    handleForgotPassword,
    handleConfirmResetPassword,
    safePlayNotificationSound,
    showNotification,
    speakText,
    STARTUP_MESSAGES,
    loadedRefs,
    hasLoggedPeerChatRef,
    isHomeworkLoaded,
    receiveRemoteWhiteboardDraw,
    clearLocalCanvas,
    handleAINoteAction,
    addHousePoints,
    handleMockLogin,
    handleEmailSignIn,
    handleGoogleSignIn,
    handleGoogleSignInWithSelect,
    updateRecentAccounts,
    handleLinkGoogle,
    handleContinueRecentAccount,
    performGoogleAuthForRecentAccount,
    handleVerifyPinAndLogin,
    handleRemoveRecentAccount,
    hashPassword,
    handleOnboardingLogin,
    handleLogout,
    handleSaveNote,
    handleSaveProfile,
    handleAddSchedule,
    handleDeleteSchedule,
    handleDeleteNote,
    handleReorderNotes,
    handleCreateNewNote,
    handleSaveAiNewNote,
    handleApplyAiEdit,
    getCoordinates,
    startDrawing,
    drawOnCanvas,
    stopDrawing,
    clearCanvas,
    drawShapeOnWhiteboard,
    loadSlide,
    handleTeacherBroadcast,
    handleStopBroadcast,
    sendStudentSignal,
    handleAddMaterial,
    toggleLikeMaterial,
    handleOpenMaterialDocument,
    handleDownloadMaterial,
    incrementViewsMaterial,
    handleAddComment,
    handleVerifyMaterial,
    toggleBookmarkMaterial,
    getAvailableSwitchAccounts,
    handleSwitchProfileAccount,
    handleTriggerMaterialAi,
    handleExportAiResult,
    handleUploadFileMaterial,
    handleQuickUploadDrag,
    handleQuickUploadDrop,
    handleQuickUploadFileChange,
    handleQuickUploadSubmit,
    handleStartQuiz,
    triggerQuizTimer,
    handleQuizSubmit,
    handleNextQuizQuestion,
    handleSendChat,
    handleShareMaterialToChat,
    handleCreateRoom,
    handleJoinRoom,
    handleAddFeedback,
    upvoteFeedback,
    saveFeedbacksToSupabase,
    handleFacultyStatusUpdate,
    readImageAsBase64,
    readFileAsDataURL,
    handleFileUploadAction,
    handleRemoveAttachedFile,
    handleCreateNewThread,
    handleSwitchPersona,
    handleSwitchMode,
    handleDeleteThread,
    handleClearThreadHistory,
    handleLeaveRoom,
    handleDeleteRoom,
    handleDeletePeerMessage,
    handleCopyToClipboard,
    handleSaveToNotes,
    handleToggleSpeakMessage,
    handleAskAIModel,
    getHouseAccentClass,
    getHousePrimaryText,
    getHouseBadgeColor
  };
  return <AppView {...viewProps} />;
}
