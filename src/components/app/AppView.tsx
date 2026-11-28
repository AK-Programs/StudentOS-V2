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
} from '../../types';
import { supabase } from '../../lib/supabase';
import { getVaultNotes, saveVaultNoteToSupabase, deleteVaultNoteFromSupabase, getNoteByCollabCode, updateNoteOrder } from '../../lib/supabaseNotes';
import { generateFormattedPdf } from '../../lib/pdfGenerator';
import { getSupabaseUserProfile, saveSupabaseUserProfile, getDefaultProfileForAccount, saveLocalProfileBackup, clearSupabaseUserProfileCache } from '../../lib/supabaseUsers';
import { getSupabaseHomework, saveSupabaseHomework, deleteSupabaseHomework } from '../../lib/supabaseHomework';
import {
  fetchAssignments,
  fetchAssessments,
  fetchTargetedAnnouncements,
  isAnnouncementEligibleForUser,
  isStudentMatchedToCohort,
  saveAssignment
} from '../../lib/academicWorkflowService';
import { getPersonalTasks, savePersonalTask, updateTaskOrder as saveTaskOrderToSupabase, deletePersonalTask } from '../../lib/supabaseTasks';
import { getAppNotifications, saveAppNotification, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, generateUUID, registerPushSubscription, getDeviceId, triggerBrowserPushNotification, isUserEligibleForNotification, triggerNotificationSound } from '../../lib/notifications';
import { requestFCMPermission, setupFCMForegroundListener } from '../../lib/fcmNotifications';
import { useContextHoldMenu, useDismissContextMenu } from '../../lib/useContextHoldMenu';
import { awardStudentXP, isHalloweenBadgeDateRange } from '../../lib/gamification';
import { getSavedTheme } from '../../lib/themeSystem';
import { ALL_GRADE_OPTIONS, getSectionsForGrade } from '../../config/academicHierarchy';
import { StudentGamificationHub } from '../StudentGamificationHub';
import {
  streamAIChatClient,
  buildAuthorizedStudentOSContext,
  detectMathInteractiveWidget,
  InteractiveMathWidget,
  saveStudyOutputToFlashcards,
  formatMathematicalText,
  extractTopicTeachingIntent
} from '../../lib/studentosAiEngine';
import { extractAttachmentContent } from '../../lib/documentExtractor';
import { AITopicTutorModal } from '../syllabus/AITopicTutorModal';
import { GamificationRewardToast, DashboardGamificationCard } from '../StudentGamificationHub';
import { 
  getAiBuddyChats, saveAiBuddyChat, deleteAiBuddyChat, renameAiBuddyChat,
  getPeerMessages, savePeerMessage, deletePeerMessage,
  getChatRooms, saveChatRoom, joinChatRoom, leaveChatRoom, deleteChatRoom,
  clearChatCache
} from '../../lib/supabaseChat';
import { saveSupabaseMaterial, getSupabaseMaterials, deleteSupabaseMaterial } from '../../lib/supabaseResources';
import { getFolders, Folder as FolderType, createFolder, renameFolder, deleteFolder } from '../../lib/supabaseFolders';
import { PdfCanvasViewer } from '../PdfCanvasViewer';
import { InAppDocumentViewer } from '../InAppDocumentViewer';
import { PanelBoardSetupDialog } from '../panel/PanelBoardSetupDialog';
import { ClassroomPanelBoard } from '../panel/ClassroomPanelBoard';
import { checkPanelRegistration, PanelBoardRegistrationData } from '../../lib/panelBoardDetector';
import { FeedbackBoard } from '../FeedbackBoard';
import { StudentOSJarvis } from '../StudentOSJarvis';
import AttendanceManager from '../AttendanceManager';
import AdminCenter, { AdminSubTab } from '../AdminCenter';
import TeacherStudentList from '../TeacherStudentList';
import TeacherStudentReports from '../TeacherStudentReports';
import TeacherProfile from '../TeacherProfile';
import StudentAttendanceView from '../StudentAttendanceView';
import StudentAiAnalytics from '../StudentAiAnalytics';
import HouseChampionship from '../HouseChampionship';
import SimpleResourceManager from '../SimpleResourceManager';
import { BlogsPortal } from '../BlogsPortal';
import { APP_VERSION } from '../../config/version';
import { AssignmentCenter } from '../AssignmentCenter';
import StudentMarksCenter from '../StudentMarksCenter';
import CoordinatorModule from '../CoordinatorModule';
import { SportsActivitiesPortal } from '../SportsActivitiesPortal';
import { SubstituteHub } from '../SubstituteHub';
import { ChatSystem } from '../ChatSystem';
import { StudentOSMeet } from '../StudentOSMeet';
import { GlobalSchoolCallModal } from '../meet/GlobalSchoolCallModal';
import { setupGlobalCallReceiver, acceptSchoolCall, declineSchoolCall } from '../../lib/callService';
import { NotificationCenter } from '../NotificationCenter';
import { BroadcastModal } from '../BroadcastModal';
import { LiveBroadcastBanner } from '../LiveBroadcastBanner';
import { StudentOSLife } from '../StudentOSLife';
import { TeacherFunZone } from '../TeacherFunZone';
import AcademicCalendar from '../AcademicCalendar';
import DigitalGradebook from '../DigitalGradebook';
import DigitalReportCards from '../DigitalReportCards';
import PerformanceAnalytics from '../PerformanceAnalytics';
import ProfileCustomizer from '../ProfileCustomizer';
import { ProfileSettings } from '../ProfileSettings';
import { PromotionalBanners } from '../PromotionalBanners';
import AIQuotaManagerModal from '../AIQuotaManagerModal';
import { WhatsNewPortal } from '../WhatsNewPortal';
import { BrandLogo } from '../brand/BrandLogo';
import { BRAND_CONFIG } from '../../config/branding';
import { AboutVeylentraPage } from '../AboutVeylentraPage';
import { SecurityDialog } from '../SecurityDialog';
import {
  getSecurityStatus,
  lockWorkspace,
  unlockWorkspace,
  setWorkspacePin,
  verifySecurityPin,
  subscribeToWorkspaceLockChanges
} from '../../lib/securityService';
import { MajorReleaseBanner } from '../MajorReleaseBanner';
import { StudyCenterFlashcards } from '../StudyCenterFlashcards';
import { LectureNotesAiModal } from '../LectureNotesAiModal';
import { LectureNotesWorkspace } from '../lectureNotes/LectureNotesWorkspace';
import { HomeworkLinkedNotesSection } from '../lectureNotes/HomeworkLinkedNotesSection';
import { NotificationFlyout } from '../NotificationFlyout';
import { NativeContextMenu } from '../ui/NativeContextMenu';
import { LevelUpCelebrationModal } from '../gamification/LevelUpCelebrationModal';
import { RegularBadgeUnlockModal } from '../gamification/RegularBadgeUnlockModal';
import { StreakRecoveryCelebrationModal } from '../gamification/StreakRecoveryCelebrationModal';
import { UnifiedEngagementPanel } from '../engagement/UnifiedEngagementPanel';
import { useEngagementOverview, recordEngagementActivity } from '../../lib/engagementService';
import { ParentalPortal } from '../ParentalPortal';
import { BrainBattleArena } from '../BrainBattleArena';
import { SyllabusStudyPlanner } from '../SyllabusStudyPlanner';
import { StudyHubDashboard } from '../StudyHubDashboard';
import { StudyHubTaskManager } from '../StudyHubTaskManager';
import { OfficialTimetableViewer } from '../OfficialTimetableViewer';
import { StudentExperienceWorkspace } from '../StudentExperienceWorkspace';
import { FacultyExperienceWorkspace } from '../FacultyExperienceWorkspace';
import { ByteOrionAssistantModal } from '../ByteOrionAssistantModal';
import { buildByteReminders } from '../../lib/byteReminderEngine';
import { isFacultyRole } from '../../config/facultyPermissions';
import { ReminderService } from '../../lib/reminderService';
import { ProfessionalTabDropdown } from '../ProfessionalTabDropdown';
import { getStoredCards } from '../../lib/flashcardStorage';
import { isCardDue } from '../../lib/sm2Algorithm';
import { getPublishedUpdates, getUserReadUpdateIds } from '../../lib/supabaseUpdates';
import { soundService } from '../../lib/soundService';
import { SoundSettingsModal } from '../SoundSettingsModal';
import { sendRealtimeEvent, subscribeRealtimeEvents } from '../../lib/wsHelper';
import {
  NumberTicker,
  BorderBeam,
  ShimmerButton,
  CardSpotlight,
  BackgroundBeams,
  SplitTextReveal
} from '../ui/animatedComponents';
import { 
  AIUsageState, 
  getLocalUsageState, 
  recordLocalMessage, 
  fetchAIUsageStatus, 
  BASE_ROLE_LIMITS 
} from '../../lib/aiUsageManager';
import { DashboardTopBar } from '../DashboardTopBar';
import {
  consumePendingNotificationIntent,
  NotificationNavIntent,
  parseNotificationIntentFromLocation,
  peekPendingNotificationIntent,
  persistPendingNotificationIntent,
  resolveNotificationDestination,
  stripNotificationParamsFromUrl,
} from '../../lib/notificationNavigation';
import { MOCK_QUIZZES, AI_PERSONAS, INITIAL_ANNOUNCEMENTS, INITIAL_FEEDBACK, INITIAL_MATERIALS, MOCK_SCHEDULES } from './mockData';
import { FloatingByteWidget } from '../byte/FloatingByteWidget';
import { StudentOSOnboardingModal } from '../onboarding/StudentOSOnboardingModal';
import { GuidedProductTour } from '../onboarding/GuidedProductTour';
import { shouldShowOnboarding } from '../../lib/onboardingService';
import { BottomSheet } from '../ui/BottomSheet';
import { VeylentraIcon } from '../ui/VeylentraIcon';
import { useFeatureAccess, isSuperAdminRole } from '../../lib/featureAccessService';
import { WinterThemeLayer } from '../winter/WinterThemeLayer';
import { WinterFestivalHub } from '../winter/WinterFestivalHub';
import { FloatingSpinWheelButton } from '../winter/FloatingSpinWheelButton';
import { XpLeaderboardPanel } from '../gamification/XpLeaderboardPanel';
import { SnowflakeVector } from '../winter/WinterArtwork';
import { scheduleSantaModelIdlePreload } from '../../lib/santaModelCache';
import { ProfileBannerBackdrop, ProfileCosmeticAvatar } from '../winter/ProfileCosmeticRenderer';
import { fetchPublicWinterCosmetics } from '../../lib/winterFestivalService';
import { BadgeUnlockCelebrationModal } from '../winter/BadgeUnlockCelebrationModal';
import { prefersReducedMotion } from '../../lib/motionSystem';
import { AcademicRichRenderer } from '../ui/AcademicRichRenderer';
import { ByteWorkspace } from '../byte/ByteWorkspace';

// Stub Integrations
import {
  handleFirestoreError, OperationType, sendNotificationToUsers,
  auth, db, GoogleAuthProvider, signInWithPopup, signOut,
  doc, collection, query, where, onSnapshot,
  setDoc, updateDoc, deleteDoc
} from '../../firebase';
import { uploadFileToStorage } from '../../lib/storageHelper';
import { presenceService } from '../../lib/presenceService';
import { logTabOpen } from '../../lib/tabUsageService';

type AppViewProps = Record<string, any>;

export function AppView(props: AppViewProps) {
  const {
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
  } = props;
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
                <div className="relative h-20 w-20 sm:h-22 sm:w-22 rounded-3xl bg-gradient-to-br from-indigo-500 via-cyan-500 to-emerald-400 p-[1.5px] shadow-2xl shadow-indigo-500/30">
                  <div className="w-full h-full bg-slate-950 rounded-[22px] flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent" />
                    <BrandLogo size={36} className="relative z-10" />
                    <span className="text-[9px] font-mono font-black text-cyan-300 tracking-wider mt-0.5 relative z-10">
                      {loadingProgress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Brand Title & Subtitle */}
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-300">
                  <span>UNIFIED ACADEMIC ECOSYSTEM</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-extrabold font-brand tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-cyan-200">
                  {BRAND_CONFIG.name}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto font-medium">
                   Smartboards · Orion AI Tutors · Realtime Broadcasts · Scholar XP Arena
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
            {/* Compact Brand Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <BrandLogo size={40} className="shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-extrabold font-brand tracking-tight text-white truncate">
                      {BRAND_CONFIG.name}
                    </h1>
                    <span className="text-[11px] font-mono text-slate-400">v{APP_VERSION}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    Academic & Institutional Workspace
                  </p>
                </div>
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
                      { type: 'parent', icon: '👨‍👩‍👧', label: 'Parent / Guardian', desc: 'Child Monitoring & Reports' },
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
                      (regRole !== 'parent' && regBirthdateError) ||
                      !regName ||
                      !regPhone ||
                      (regRole !== 'parent' && !regBirthdate) ||
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
                          if (val && val.trim().length < 2) {
                            setRegNameError('Name must be at least 2 characters');
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
                      <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">Phone (Optional for Parent)</label>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegPhone(val);
                          setRegPhoneError('');
                        }}
                        placeholder="+91 98765 43210"
                        className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 focus:outline-none focus:border-indigo-500 text-white"
                      />
                    </div>

                    {regRole !== 'parent' && (
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
                    )}
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

                  {regRole === 'parent' && (
                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs flex items-start gap-2.5">
                      <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold text-white block mb-0.5">Parent / Guardian Workspace</span>
                        As a verified parent, you will link your children's accounts inside the Parental Portal using secure 6-digit email OTP verification. No student grade or teacher department details are required.
                      </div>
                    </div>
                  )}

                  {regRole === 'student' && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Grade</label>
                        <select
                          value={regGrade}
                          onChange={(e) => {
                            const newG = e.target.value;
                            setRegGrade(newG);
                            const validSecs = getSectionsForGrade(newG);
                            if (!validSecs.includes(regSection as any)) {
                              setRegSection(validSecs[0]);
                            }
                          }}
                          className="w-full text-xs px-2.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-white"
                        >
                          {ALL_GRADE_OPTIONS.map((g) => (
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
                          {getSectionsForGrade(regGrade).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
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
          <WinterThemeLayer currentUser={currentUser} />
          
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
            className={`fixed top-0 left-0 h-dvh bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border-r border-white/10 z-50 flex flex-col justify-between transition-all duration-300 motion-reduce:transition-none safe-area-pt safe-area-pb ${
              sidebarOpen
                ? 'w-[min(268px,calc(100vw-2rem))] sm:w-64 p-3.5 sm:p-4 translate-x-0 shadow-2xl'
                : 'w-0 -translate-x-full overflow-hidden p-0 md:w-20 md:p-3 md:translate-x-0 md:overflow-visible'
            }`}
          >
            {/* Sidebar Header Brand & Collapse Controls */}
            <div className="shrink-0 space-y-3 pb-3 border-b border-white/10">
              <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'md:justify-center justify-between'}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!sidebarOpen) setSidebarOpen(true);
                      else handleTabSelect('dashboard');
                    }}
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer overflow-hidden"
                    title={sidebarOpen ? `${BRAND_CONFIG.name} Dashboard` : `Expand ${BRAND_CONFIG.name} Sidebar`}
                  >
                    <BrandLogo size={36} />
                  </button>
                  {sidebarOpen && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-brand font-extrabold text-white tracking-tight truncate leading-none">
                        {BRAND_CONFIG.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono mt-1 leading-none">
                        v{APP_VERSION}
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

              {/* Quick Module Search Filter (when expanded) */}
              {sidebarOpen && (
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
              )}
            </div>

            {/* Scrollable Navigation Body */}
            <nav className="flex-1 min-h-0 overflow-y-auto py-3 pr-1 space-y-4 scrollbar-thin">
              {(() => {
                const q = sidebarSearchQuery.trim().toLowerCase();
                const matchesFilter = (label: string, keywords: string = '') => {
                  if (!q) return true;
                  return label.toLowerCase().includes(q) || keywords.toLowerCase().includes(q);
                };

                // DEDICATED STREAMLINED NAVIGATION FOR PARENTS
                if (effectiveRole === 'parent') {
                  return (
                    <div className="space-y-1.5 px-1">
                      {sidebarOpen && (
                        <div className="px-2.5 py-1 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                          Family Workspace
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTabSelect('parent_portal')}
                        className={getSidebarBtnClass('parent_portal')}
                        title="Parental Portal"
                      >
                        <Shield className="w-4 h-4 shrink-0 text-violet-400" />
                        {sidebarOpen && <span className="truncate">Family Portal</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTabSelect('whats_new')}
                        className={getSidebarBtnClass('whats_new')}
                        title="School Bulletins & Announcements"
                      >
                        <Zap className="w-4 h-4 shrink-0 text-amber-400" />
                        {sidebarOpen && <span className="truncate">School Bulletin</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTabSelect('profile')}
                        className={getSidebarBtnClass('profile')}
                        title="Parent Profile & Preferences"
                      >
                        <User className="w-4 h-4 shrink-0 text-indigo-400" />
                        {sidebarOpen && <span className="truncate">Parent Profile</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTabSelect('about')}
                        className={getSidebarBtnClass('about')}
                        title="About Veylentra"
                      >
                        <Info className="w-4 h-4 shrink-0 text-slate-400" />
                        {sidebarOpen && <span className="truncate">About Veylentra</span>}
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    {/* ORION COPILOT BUTTON — GLOBAL FOR ALL ROLES */}
                    {matchesFilter('Orion AI Copilot Assistant', 'orion ai copilot voice assistant 3d') && (
                      <div className="pb-1.5">
                        <button
                          type="button"
                          onClick={() => setIsJarvisActive(true)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs text-slate-200 bg-slate-800/70 hover:bg-slate-800 border border-indigo-500/30 hover:border-indigo-400/60 transition-all cursor-pointer group shadow-sm"
                          title="Open Orion AI Copilot & School Assistant"
                        >
                          <div className="w-5 h-5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 group-hover:text-indigo-200 transition-colors shrink-0">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          {sidebarOpen && (
                            <div className="flex items-center justify-between flex-1 min-w-0">
                              <span className="truncate font-semibold text-slate-100">Orion AI</span>
                              <span className="text-[10px] font-mono text-indigo-300/80 px-1.5 py-0.2 rounded bg-indigo-500/10 shrink-0">Copilot</span>
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
                              <VeylentraIcon name="dashboard" size="sm" />
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
                                  <VeylentraIcon name="study_hub" size="sm" />
                                  {sidebarOpen && (
                                    <div className="flex items-center justify-between flex-1 min-w-0">
                                      <span className="truncate">Study Hub</span>
                                      {dueCardsCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-200 font-mono font-bold text-[10px] leading-none shrink-0 ml-1">
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
                                          setSelectedFlashcardDeckId(null);
                                          setStudyHubSubTab('dashboard');
                                          handleTabSelect('study_hub');
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                          ['study_hub', 'dashboard'].includes(activeTab) && studyHubSubTab === 'dashboard'
                                            ? 'bg-blue-600/20 text-blue-200 font-semibold'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                      >
                                        <span className="truncate">Study Dashboard</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedFlashcardDeckId(null);
                                          setStudyHubSubTab('flashcards');
                                          handleTabSelect('study_hub');
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                          ['study_hub', 'flashcards'].includes(activeTab) && studyHubSubTab === 'flashcards'
                                            ? 'bg-blue-600/20 text-blue-200 font-semibold'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                      >
                                        <span className="truncate">Study Flashcards</span>
                                        {dueCardsCount > 0 && (
                                          <span className="text-[10px] font-mono text-rose-400 font-bold shrink-0 ml-1">
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
                                            ? 'bg-blue-600/20 text-blue-200 font-semibold'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                      >
                                        <span className="truncate">Tasks & Objectives</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStudyHubSubTab('planner');
                                          handleTabSelect('study_hub');
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                                          ['study_hub', 'planner'].includes(activeTab) && studyHubSubTab === 'planner'
                                            ? 'bg-blue-600/20 text-blue-200 font-semibold'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                      >
                                        <span className="truncate">Schedule Planner</span>
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
                              <VeylentraIcon name="notes" size="sm" />
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
                                <VeylentraIcon name="calendar" size="sm" />
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
                                <VeylentraIcon name="target" size="sm" />
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
                                <PenTool className="w-4 h-4 shrink-0 text-sky-400" />
                                {sidebarOpen && <span className="truncate">Class Whiteboard</span>}
                              </button>
                            )}

                          {(!presentationMode || isTabAllowedInPresentation('panel_board')) &&
                            matchesFilter('Panel Board', 'smart panel display projector classroom interactive touch') && (
                              <button
                                type="button"
                                onClick={handleOpenPanelBoard}
                                className={isPanelBoardOpen ? 'group relative w-full flex items-center transition-all duration-200 rounded-xl border text-left min-w-0 cursor-pointer bg-blue-600 text-white shadow-lg shadow-blue-600/30 border-blue-500/50 gap-3 px-3 py-2.5' : getSidebarBtnClass('panel_board')}
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
                                <VeylentraIcon name="byte" size="sm" />
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
                                <VeylentraIcon name="materials" size="sm" />
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
                                <VeylentraIcon name="check" size="sm" />
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
                                <VeylentraIcon name="homework" size="sm" />
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
                              <VeylentraIcon name="trophy" size="sm" />
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
                                <VeylentraIcon name="chat" size="sm" />
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
                                <VeylentraIcon name="peer_chat" size="sm" />
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
                                <VeylentraIcon name="merit" size="sm" />
                                {sidebarOpen && <span className="truncate">House Standings</span>}
                              </button>
                            )}

                            {canViewWinterHub && matchesFilter('Winter Festival', 'winter santa gift wheel cookies badges snow') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('winter_festival')}
                                className={getSidebarBtnClass('winter_festival')}
                                title="Winter Festival"
                              >
                                <SnowflakeVector size={16} className={`shrink-0 ${activeTab === 'winter_festival' ? 'text-white' : 'text-sky-300'}`} />
                                {sidebarOpen && <span className="truncate">Winter Festival</span>}
                              </button>
                            )}

                            {matchesFilter('Veylentra Life', 'competitions clubs events polls badges') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('life')}
                                className={getSidebarBtnClass('life')}
                                title="Veylentra Life: Competitions, Clubs, Events & Polls"
                              >
                                <VeylentraIcon name="clover" size="sm" />
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
                                <Activity className="w-4 h-4 shrink-0 text-emerald-400" />
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
                                <Globe className="w-4 h-4 shrink-0 text-blue-400" />
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
                                <VeylentraIcon name="send" size="sm" />
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
                                <VeylentraIcon name="analytics" size="sm" />
                                {sidebarOpen && <span className="truncate">Analytics</span>}
                              </button>
                            )}

                            {matchesFilter('Substitute Board', 'teacher duty cover') && ['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('substitutes')}
                                className={getSidebarBtnClass('substitutes')}
                                title="Substitute Board"
                              >
                                <RefreshCw className="w-4 h-4 shrink-0 text-amber-400" />
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
                                <VeylentraIcon name="user" size="sm" />
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

                            {(effectiveRole as string) === 'parent' && matchesFilter('Parental Portal', 'parent guardian monitoring reports') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('parent_portal')}
                                className={getSidebarBtnClass('parent_portal')}
                                title="Parental Portal"
                              >
                                <VeylentraIcon name="lock" size="sm" />
                                {sidebarOpen && <span className="truncate font-semibold">Parental Portal</span>}
                              </button>
                            )}

                            {matchesFilter("What's New", 'updates changelog releases') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('whats_new')}
                                className={getSidebarBtnClass('whats_new')}
                                title="What's New in Veylentra"
                              >
                                <VeylentraIcon name="whats_new" size="sm" />
                                {sidebarOpen && (
                                  <div className="flex items-center justify-between flex-1 min-w-0">
                                    <span className="truncate">What's New</span>
                                    {whatsNewUnreadCount > 0 && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white font-mono font-bold text-[10px] leading-none shrink-0 ml-1">
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

                            {isFacultyRole(effectiveRole) && matchesFilter('Faculty Center', 'teacher coordinator hod dashboard classes') && (
                              <button
                                type="button"
                                onClick={() => handleTabSelect('faculty')}
                                className={getSidebarBtnClass('faculty', 'faculty')}
                                title="Faculty Center"
                              >
                                <VeylentraIcon name="graduation" size="sm" />
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
                                  <VeylentraIcon name="attendance" size="sm" />
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
                                  <VeylentraIcon name="admin" size="sm" />
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

            {/* Sidebar Footer User Detail & Interactive Account Switcher */}
            <div className="shrink-0 pt-3 border-t border-white/10 space-y-2 relative">
              {/* Account Switcher Expanded Menu */}
              {accountSwitcherExpanded && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs" 
                    onClick={() => setAccountSwitcherExpanded(false)} 
                  />
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-slate-900/98 border border-white/15 rounded-2xl shadow-2xl p-3 z-50 text-white space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:transition-none">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div>
                        <span className="text-xs font-bold text-white block">Switch Profile Account</span>
                        <span className="text-[10px] text-slate-400">Switch workspace profile seamlessly</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAccountSwitcherExpanded(false)}
                        className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                        aria-label="Close account switcher"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                      {getAvailableSwitchAccounts().map(acc => {
                        const isCurrent = acc.uid === currentUser.uid;
                        const roleLabel = acc.role === 'super_admin' ? 'Super Admin' : acc.role.charAt(0).toUpperCase() + acc.role.slice(1);
                        const roleBadgeColor = acc.role === 'super_admin' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                                               acc.role === 'admin' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                                               acc.role === 'teacher' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                               acc.role === 'parent' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                               'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
                        return (
                          <button
                            key={acc.uid}
                            type="button"
                            onClick={() => {
                              handleSwitchProfileAccount(acc.uid);
                              setAccountSwitcherExpanded(false);
                              showNotification(`Switched profile to ${acc.name}`);
                            }}
                            className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer ${
                              isCurrent ? 'bg-indigo-600/30 border border-indigo-500/40' : 'hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                              acc.house ? getHouseBadgeColor(acc.house) : 'bg-slate-700'
                            }`}>
                              {acc.name ? acc.name[0] : '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white truncate">{acc.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded-sm border font-medium uppercase tracking-wider ${roleBadgeColor}`}>
                                  {roleLabel}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 truncate block">{acc.email}</span>
                            </div>
                            {isCurrent && (
                              <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountSwitcherExpanded(false);
                          (window as any).__studentos_explicit_logout__ = true;
                          setRegStep('login');
                          setCurrentUser(null);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl transition-all font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Account</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountSwitcherExpanded(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-300 border border-rose-500/20 rounded-xl transition-all font-semibold cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Current Profile Card / Toggle Switcher */}
              {sidebarOpen ? (
                <button
                  type="button"
                  onClick={() => setAccountSwitcherExpanded(prev => !prev)}
                  className="relative overflow-hidden w-full p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 flex items-center gap-3 text-left transition-colors cursor-pointer group"
                  title="Click to switch accounts or manage profile"
                >
                  {sidebarWinterCosmetics.equippedBanner && (
                    <div className="pointer-events-none absolute inset-0 opacity-45" aria-hidden="true">
                      <ProfileBannerBackdrop equippedBanner={sidebarWinterCosmetics.equippedBanner} className="w-full h-full" />
                      <div className="absolute inset-0 bg-slate-950/55" />
                    </div>
                  )}
                  <ProfileCosmeticAvatar
                    name={currentUser.name || 'Veylentra User'}
                    avatarUrl={currentUser.photoURL}
                    equippedBorder={sidebarWinterCosmetics.equippedBorder}
                    size="sm"
                    className="relative z-10"
                    fallbackBgClass={currentUser.house ? `${getHouseBadgeColor(currentUser.house)} text-white` : 'bg-slate-700 text-white'}
                  />
                  <div className="relative z-10 flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-white truncate leading-tight group-hover:text-indigo-200 transition-colors">
                      {currentUser.name || 'Veylentra User'}
                    </span>
                    <span className="text-[10px] text-slate-300 truncate mt-0.5 font-medium">
                      {presentationMode ? 'Presenter Mode' : getUserProfileTitle(currentUser, effectiveRole)}
                    </span>
                  </div>
                  <ChevronDown className={`relative z-10 w-3.5 h-3.5 text-slate-300 transition-transform duration-200 shrink-0 ${accountSwitcherExpanded ? 'rotate-180 text-white' : ''}`} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAccountSwitcherExpanded(prev => !prev)}
                  className="w-full flex items-center justify-center p-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  title={`${currentUser.name || 'User'} — Click to switch accounts`}
                >
                  <ProfileCosmeticAvatar
                    name={currentUser.name || 'Veylentra User'}
                    avatarUrl={currentUser.photoURL}
                    equippedBorder={sidebarWinterCosmetics.equippedBorder}
                    size="xs"
                    fallbackBgClass={currentUser.house ? `${getHouseBadgeColor(currentUser.house)} text-white` : 'bg-slate-700 text-white'}
                  />
                </button>
              )}

              {/* Action Buttons: Profile and Sign Out */}
              {sidebarOpen && (
                <div className="w-full flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleTabSelect('profile')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl transition-all font-semibold cursor-pointer truncate"
                    title="Open Profile Settings"
                  >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-300 border border-rose-500/20 rounded-xl transition-all font-semibold cursor-pointer truncate"
                    title="Sign out of Veylentra"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Sign Out</span>
                  </button>
                </div>
              )}
              {!sidebarOpen && (
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
            <LiveBroadcastBanner currentUser={currentUser} effectiveRole={effectiveRole} />

            {/* Global Workspace Header bar */}
            <DashboardTopBar
              activeTab={activeTab}
              studyHubSubTab={studyHubSubTab}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              effectiveRole={effectiveRole}
              currentUser={currentUser}
              clock={clock}
              ttsEnabled={ttsEnabled}
              onToggleTts={() => setTtsEnabled(!ttsEnabled)}
              onOpenSoundSettings={() => setIsSoundSettingsModalOpen(true)}
              onOpenVoiceAssistant={() => {
                if (currentUser) {
                  setByteOrionModalMode('select');
                  setIsByteOrionModalOpen(true);
                }
              }}
              fontSize={fontSize}
              onCycleFontSize={() =>
                setFontSize((prev) =>
                  prev === 'standard' ? 'large' : prev === 'large' ? 'huge' : 'standard'
                )
              }
              highContrast={highContrast}
              onToggleHighContrast={() => setHighContrast(!highContrast)}
              presentationMode={presentationMode}
              hasPinConfigured={hasPinConfigured}
              onOpenSecurityCenter={() => setSecurityMenuOpen(true)}
              onOpenBroadcast={() => setIsBroadcastModalOpen(true)}
              unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
              showNotifCenter={showNotifCenter}
              onToggleNotifCenter={() => setShowNotifCenter(!showNotifCenter)}
              onCloseNotifCenter={() => setShowNotifCenter(false)}
              onNavigateTab={(tab) => handleTabSelect(tab)}
              whatsNewUnreadCount={whatsNewUnreadCount}
            />

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
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-sky-500/50 flex flex-col items-center justify-center text-center gap-4 h-full"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-sky-500/10 text-sky-400 flex items-center justify-center rounded-2xl border border-sky-500/20 group-hover:scale-105 transition-transform">
                        <VeylentraIcon name="editor" size="xl" />
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">Class Whiteboard</h3>
                        <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">Launch the interactive full-screen classroom smart board projection.</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => handleTabSelect('materials')}
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-emerald-500/50 flex flex-col items-center justify-center text-center gap-4 h-full"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/10 text-emerald-400 flex items-center justify-center rounded-2xl border border-emerald-500/20 group-hover:scale-105 transition-transform">
                        <VeylentraIcon name="materials" size="xl" />
                      </div>
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
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-amber-500/50 flex flex-col items-center justify-center text-center gap-4 h-full"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-500/10 text-amber-400 flex items-center justify-center rounded-2xl border border-amber-500/20 group-hover:scale-105 transition-transform">
                        <VeylentraIcon name="ai_tutor" size="xl" />
                      </div>
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
                      onClick={() => {
                        setOrionInitialQuery('');
                        setIsJarvisActive(true);
                      }}
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-cyan-500/50 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden h-full"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-cyan-500/10 text-cyan-400 flex items-center justify-center rounded-2xl border border-cyan-500/20 group-hover:scale-105 transition-transform relative z-10">
                        <VeylentraIcon name="orion" size="xl" />
                      </div>
                      <div className="relative z-10">
                        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mb-2 uppercase">Orion Copilot</h3>
                        <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">Activate the voice-command smart classroom AI assistant.</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => handleTabSelect('notes')}
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-amber-500/50 flex flex-col items-center justify-center text-center gap-4 h-full"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-500/10 text-amber-400 flex items-center justify-center rounded-2xl border border-amber-500/20 group-hover:scale-105 transition-transform">
                        <VeylentraIcon name="notes" size="xl" />
                      </div>
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
                      className="group cursor-pointer bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-5 sm:p-8 hover:bg-slate-800 transition-all hover:border-rose-500/50 flex flex-col items-center justify-center text-center gap-4 h-full"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-500/10 text-rose-400 flex items-center justify-center rounded-2xl border border-rose-500/20 group-hover:scale-105 transition-transform">
                        <VeylentraIcon name="pomodoro" size="xl" />
                      </div>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">Focus Timer</h3>
                        <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">Customizable work sessions with auditory bell sound alerts.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 1: Dashboard View / Modern Student Experience 2.0 */}
              {activeTab === 'dashboard' && effectiveRole === 'student' && (
                <StudentExperienceWorkspace
                  currentUser={currentUser}
                  effectiveRole={effectiveRole}
                  homeworkList={homeworkList}
                  tasks={tasks}
                  announcements={announcements}
                  dueCardsCount={dueCardsCount}
                  onNavigateTab={(tab, sub) => {
                    if (tab === 'study_hub' && sub) {
                      setStudyHubSubTab(sub as any);
                    }
                    handleTabSelect(tab);
                  }}
                  onOpenOrionFull={(query) => {
                    setOrionInitialQuery(query || '');
                    setIsJarvisActive(true);
                  }}
                  showNotification={showNotification}
                />
              )}

              {/* General / Faculty / Admin Dashboard View */}
              {activeTab === 'dashboard' && effectiveRole !== 'student' && (
                <div className="space-y-6 animate-fadeIn">
                  
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

                  {['teacher', 'coordinator', 'hod'].includes(effectiveRole || '') ? (
                    <FacultyExperienceWorkspace
                      currentUser={currentUser}
                      effectiveRole={effectiveRole}
                      homeworkList={homeworkList}
                      announcements={announcements}
                      onNavigateTab={handleTabSelect}
                      onOpenOrionFull={(query) => {
                        setOrionInitialQuery(query || '');
                        setIsJarvisActive(true);
                      }}
                      showNotification={showNotification}
                    />
                  ) : (
                    <>
                  {/* Welcome Hero & Context Header */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-5 sm:p-7 rounded-2xl relative overflow-hidden bg-slate-900 border border-slate-800 shadow-md"
                  >
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-semibold text-slate-200">
                            {(currentUser as any).schoolName || 'Veylentra International Academy'}
                          </span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="capitalize">
                            {effectiveRole?.replace('_', ' ')}
                          </span>
                          {((effectiveRole as string) === 'student' || Boolean(currentUser.grade)) && (
                            <>
                              <span aria-hidden="true" className="text-slate-600">·</span>
                              <span>
                                {currentUser.grade || 'Grade 10'} {currentUser.section ? `(${currentUser.section})` : ''}
                              </span>
                            </>
                          )}
                          {currentUser.house && (
                            <>
                              <span aria-hidden="true" className="text-slate-600">·</span>
                              <span className="font-medium text-slate-300">
                                {currentUser.house} House
                              </span>
                            </>
                          )}
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                          <SplitTextReveal text={`Welcome back, ${currentUser.name}`} />
                        </h1>
                      </div>

                      {/* Authoritative Streak Card — Zero hardcoded fallbacks */}
                      <button
                        type="button"
                        onClick={() =>
                          handleTabSelect((effectiveRole as string) === 'student' ? 'study_hub' : 'leaderboard')
                        }
                        className="flex items-center gap-3 bg-slate-800/80 hover:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-700/80 shrink-0 cursor-pointer transition-colors shadow-sm text-left group"
                        title="View streak & consistency details"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                          <Flame className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-base font-bold font-mono tabular-nums text-white">
                              <NumberTicker
                                value={engagementOverview?.streak?.currentStreak ?? 0}
                                suffix=" Days"
                              />
                            </span>
                            <span className="text-[10px] text-amber-400 font-medium capitalize">
                              {(engagementOverview?.streak?.streakState || 'active').replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-normal">
                            Best {engagementOverview?.streak?.longestStreak ?? 0}d
                          </p>
                        </div>
                      </button>
                    </div>
                  </motion.div>

                  {/* Essential Action Cards Section (Role-based) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Essential Actions
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                      {(effectiveRole as string) === 'student' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('attendance_manager')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="attendance" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Attendance</span>
                              <span className="text-[11px] text-slate-400 block truncate">Check roll & stats</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('homework')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="homework" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Homework</span>
                              <span className="text-[11px] text-slate-400 block truncate">Tasks & due dates</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('notes')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="notes" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Notes</span>
                              <span className="text-[11px] text-slate-400 block truncate">Lecture notes</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('materials')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="materials" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Materials</span>
                              <span className="text-[11px] text-slate-400 block truncate">Class resources</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('ai_teacher')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="byte" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Byte AI</span>
                              <span className="text-[11px] text-slate-400 block truncate">Learning assistant</span>
                            </div>
                          </button>
                        </>
                      )}

                      {effectiveRole === 'teacher' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('attendance_manager')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="attendance" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Attendance</span>
                              <span className="text-[11px] text-slate-400 block truncate">Mark daily roll</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('homework')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="homework" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Homework</span>
                              <span className="text-[11px] text-slate-400 block truncate">Assign & review</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('notes')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="notes" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Notes</span>
                              <span className="text-[11px] text-slate-400 block truncate">Lecture notes</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('materials')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="materials" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Materials</span>
                              <span className="text-[11px] text-slate-400 block truncate">Share resources</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('faculty')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="study_suite" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Faculty</span>
                              <span className="text-[11px] text-slate-400 block truncate">Gradebook & roster</span>
                            </div>
                          </button>
                        </>
                      )}

                      {effectiveRole === 'parent' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('parent_portal')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="user" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">My Children</span>
                              <span className="text-[11px] text-slate-400 block truncate">Student profiles</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('parent_portal')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="attendance" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Attendance</span>
                              <span className="text-[11px] text-slate-400 block truncate">Daily register</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('parent_portal')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="homework" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Homework</span>
                              <span className="text-[11px] text-slate-400 block truncate">Track assignments</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('whats_new')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="notification" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Notices</span>
                              <span className="text-[11px] text-slate-400 block truncate">Announcements</span>
                            </div>
                          </button>
                        </>
                      )}

                      {['coordinator', 'admin', 'super_admin'].includes(effectiveRole) && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('attendance_manager')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="attendance" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Attendance</span>
                              <span className="text-[11px] text-slate-400 block truncate">School register</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('homework')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="homework" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Homework</span>
                              <span className="text-[11px] text-slate-400 block truncate">School submissions</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('notes')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="notes" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Notes</span>
                              <span className="text-[11px] text-slate-400 block truncate">Lecture notes</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect('materials')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="materials" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">Materials</span>
                              <span className="text-[11px] text-slate-400 block truncate">Resource vault</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabSelect(effectiveRole === 'coordinator' ? 'whats_new' : 'admin')}
                            className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-colors flex flex-col items-start justify-between gap-3 text-left cursor-pointer group shadow-sm"
                          >
                            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                              <VeylentraIcon name="settings" size="sm" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-100 block truncate">
                                {effectiveRole === 'coordinator' ? 'Notices' : 'Admin'}
                              </span>
                              <span className="text-[11px] text-slate-400 block truncate">Control panel</span>
                            </div>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Core Metrics Summary Strip (Students only; non-students get dedicated role-scoped panel below) */}
                  {(effectiveRole as string) === 'student' && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <div
                        onClick={() => { setStudyHubSubTab('tasks'); handleTabSelect('study_hub'); }}
                        className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between cursor-pointer shadow-sm"
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-slate-400">Open Tasks</span>
                          <h3 className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
                            <NumberTicker value={tasks.filter(t => !t.completed).length} />
                          </h3>
                        </div>
                        <div className="h-8 w-8 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400 shrink-0">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                      </div>

                      <div
                        onClick={() => handleTabSelect('notes')}
                        className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between cursor-pointer shadow-sm"
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-slate-400">Saved Notes</span>
                          <h3 className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
                            <NumberTicker value={vaultNotes.length} />
                          </h3>
                        </div>
                        <div className="h-8 w-8 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                      </div>

                      <div
                        onClick={() => handleTabSelect('brain_battle')}
                        className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between cursor-pointer shadow-sm"
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-slate-400">Brain Battles</span>
                          <h3 className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
                            <NumberTicker value={currentUser.quizzesTaken ?? 0} />
                          </h3>
                        </div>
                        <div className="h-8 w-8 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 shrink-0">
                          <Trophy className="w-4 h-4" />
                        </div>
                      </div>

                      <div
                        onClick={() => handleTabSelect('pomodoro')}
                        className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between cursor-pointer shadow-sm"
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-slate-400">Study Hours</span>
                          <h3 className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
                            <NumberTicker value={currentUser.studyHours ?? 0} suffix="h" />
                          </h3>
                        </div>
                        <div className="h-8 w-8 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-center text-rose-400 shrink-0">
                          <Clock className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Role-Aware Engagement, Streak Recovery & Mission Engine */}
                  <UnifiedEngagementPanel
                    currentUser={currentUser}
                    effectiveRole={effectiveRole || currentUser.role}
                    overview={engagementOverview}
                    loading={engagementLoading}
                    onNavigateTab={(tabId, subTab) => {
                      if (subTab === 'flashcards') setStudyHubSubTab('flashcards');
                      if (tabId === 'admin' && subTab) {
                        setSelectedAdminSubTab(subTab as AdminSubTab);
                      }
                      handleTabSelect(tabId);
                    }}
                    showNotification={showNotification}
                    onRefresh={refreshEngagementOverview}
                  />

                  {/* StudentOS Scholar Gamification Summary Card (Students only — never shows student study metrics to Admin/Faculty) */}
                  {(effectiveRole as string) === 'student' && (
                    <DashboardGamificationCard currentUser={currentUser} />
                  )}

                  {/* StudentOS Life — Role-Aware Dashboard Community Hub Card (Visible to All Authenticated Roles) */}
                  <div className="p-5 sm:p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-semibold text-indigo-400">Campus Community</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span>
                            {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '')
                              ? `${(effectiveRole || 'faculty').replace('_', ' ')} Access`
                              : 'Student Life'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white tracking-tight">
                          {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '')
                            ? 'Campus Activities, Competitions & Merit Badges'
                            : 'Competitions, Student Clubs, Live Polls & House Spirit'}
                        </h3>
                        <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                          {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '')
                            ? 'Supervise student clubs, publish campus polls, coordinate school competitions, and award merit badges.'
                            : 'Register for inter-house Olympiads, join student clubs, vote in live school polls, and earn academic merit badges.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTabSelect('life')}
                          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                        >
                          <Compass className="w-4 h-4" />
                          <span>
                            {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole || '')
                              ? 'Manage Campus Life'
                              : 'Explore Campus Life'}
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
                  {/* Study Hub Unified Sub-Tabs Navigation */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-xl p-2.5 rounded-2xl border border-white/10 shadow-lg relative z-20">
                    <div className="w-full sm:max-w-md">
                      <ProfessionalTabDropdown
                        options={[
                          {
                            id: 'dashboard',
                            label: 'Study Dashboard',
                            icon: '🎯',
                            description: 'Overview of your learning progress'
                          },
                          {
                            id: 'flashcards',
                            label: 'Study Center & Flashcards',
                            icon: '🗂️',
                            badge: dueCardsCount > 0 ? `${dueCardsCount} due` : undefined,
                            badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
                            description: 'Spaced repetition decks and active recall'
                          },
                          {
                            id: 'tasks',
                            label: 'Task Manager',
                            icon: '📋',
                            badge: tasks.filter(t => !t.completed).length > 0 ? tasks.filter(t => !t.completed).length : undefined,
                            description: 'Track assignments and study goals'
                          },
                          {
                            id: 'planner',
                            label: 'Study Schedule Planner',
                            icon: '📅',
                            badge: schedules.length > 0 ? schedules.length : undefined,
                            description: 'Daily revision timetable and exam prep'
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

                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
                      <VeylentraIcon name="study_hub" size="sm" />
                      <span className="font-semibold">
                        {studyHubSubTab === 'dashboard' ? 'Overview' : studyHubSubTab === 'flashcards' ? 'Study Center' : studyHubSubTab === 'tasks' ? 'Task Manager' : 'Study Planner'}
                      </span>
                    </div>
                  </div>

                  {/* Sub-tab 0: Dashboard */}
                  {studyHubSubTab === 'dashboard' && (
                    <StudyHubDashboard 
                      currentUser={currentUser}
                      dueCardsCount={dueCardsCount}
                      tasks={tasks}
                      serverStreak={engagementOverview?.streak?.currentStreak ?? 0}
                      onNavigateTab={(tab, sub, contextId) => {
                        if (tab === 'study_hub' && sub) {
                          if (sub === 'flashcards' && contextId) {
                            setSelectedFlashcardDeckId(contextId);
                          }
                          setStudyHubSubTab(sub as any);
                        } else {
                          handleTabSelect(tab as any);
                        }
                      }}
                    />
                  )}

                  {/* Sub-tab 1: Flashcards & Spaced Repetition Study Center */}
                  {studyHubSubTab === 'flashcards' && (
                    <StudyCenterFlashcards 
                      key={currentUser?.uid || currentUser?.email || 'flashcards'}
                      currentUser={currentUser} 
                      showNotification={showNotification}
                      onNavigateTab={handleTabSelect}
                      initialDeckId={selectedFlashcardDeckId}
                    />
                  )}

                  {/* Sub-tab 2: Task Manager View */}
                  {studyHubSubTab === 'tasks' && (
                    <StudyHubTaskManager 
                      currentUser={currentUser}
                      showNotification={showNotification}
                      tasks={tasks}
                      onTasksChange={setTasks}
                      onNavigateTab={(tab, sub) => {
                        if (tab === 'study_hub' && sub) {
                          setStudyHubSubTab(sub as any);
                        } else {
                          handleTabSelect(tab as any);
                        }
                      }}
                    />
                  )}

                  {/* Sub-tab 3: Syllabus Planner & Study Sessions View */}
                  {studyHubSubTab === 'planner' && (
                    <div className="smart-glass p-4 sm:p-6 md:p-8 rounded-3xl space-y-6 max-w-5xl mx-auto animate-fadeIn">
                      <SyllabusStudyPlanner
                        currentUser={currentUser}
                        effectiveRole={effectiveRole}
                        showNotification={showNotification}
                        onNavigateToTab={(tab, sub) => {
                          if (tab === 'study_hub' && sub) {
                            setStudyHubSubTab(sub as any);
                          } else {
                            handleTabSelect(tab as any);
                          }
                        }}
                        legacySchedules={schedules}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Personal Lecture Notes Workspace */}
              {activeTab === 'notes' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  <LectureNotesWorkspace
                    notes={vaultNotes}
                    selectedNoteId={selectedNoteId}
                    folders={vaultFolders as any}
                    homeworkList={homeworkList}
                    currentUserId={currentUser?.uid}
                    onSelectNote={id => setSelectedNoteId(id)}
                    onUpdateNote={async (id, updates) => {
                      const prevTarget = vaultNotesRef.current.find(n => n.id === id);
                      const merged = prevTarget ? { ...prevTarget, ...updates } : null;
                      setVaultNotes(prev => {
                        const next = prev.map(n => n.id === id ? { ...n, ...updates } : n);
                        vaultNotesRef.current = next;
                        return next;
                      });
                      if (merged) {
                        try {
                          await saveVaultNoteToSupabase(merged, currentUser?.uid);
                          if (currentUser && (updates.content !== undefined || updates.title !== undefined)) {
                            const now = Date.now();
                            if (now - lastNoteEngagementAtRef.current > 12000) {
                              lastNoteEngagementAtRef.current = now;
                              void recordEngagementActivity(currentUser, effectiveRole || 'student', 'study_session', 1, {
                                title: 'Lecture note saved',
                                subtitle: `Saved updates to "${merged.title}".`,
                                ctaLabel: 'Open Lecture Notes',
                                actionTab: 'notes',
                                reason: 'Saved lecture note',
                              });
                            }
                          }
                        } catch (_) {}
                      }
                    }}
                    onCreateNote={(partial) => {
                      const newId = 'note-' + Date.now();
                      const newNote: VaultNote = {
                        id: newId,
                        title: partial?.title || 'Untitled Note',
                        subject: partial?.subject || 'Physics',
                        content: partial?.content || '# Untitled Note\n\nClick here and start typing your lecture note...',
                        createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        icon: partial?.icon || '📝',
                        coverBg: partial?.coverBg || 'bg-gradient-to-r from-violet-600 to-indigo-900',
                        userId: currentUser?.uid || 'guest'
                      };
                      setVaultNotes(prev => [newNote, ...prev]);
                      setSelectedNoteId(newId);
                      saveVaultNoteToSupabase(newNote, currentUser?.uid).catch(() => {});
                      if (currentUser && partial?.content && partial.content.trim().length > 0) {
                        void recordEngagementActivity(currentUser, effectiveRole || 'student', 'study_session', 1, {
                          title: 'Study note created',
                          subtitle: `Saved "${newNote.title}" to Lecture Notes.`,
                          ctaLabel: 'Open Lecture Notes',
                          actionTab: 'notes',
                          reason: 'Created lecture note',
                        });
                      }
                      showNotification(`✓ Created "${newNote.title}"!`);
                    }}
                    onCreateFolder={async (partialFolder) => {
                      const cleanName = String(partialFolder?.name || '').trim();
                      if (!cleanName) return;
                      if (currentUser?.uid) {
                        try {
                          const saved = await createFolder(cleanName, 'notes', currentUser.uid);
                          setVaultFolders(prev => [saved, ...prev]);
                          return;
                        } catch (_) {}
                      }
                      const localFolder: FolderType = {
                        id: partialFolder?.id || 'f_' + Date.now(),
                        name: cleanName,
                        type: 'notes',
                        user_id: currentUser?.uid || 'guest',
                        created_at: new Date().toISOString()
                      };
                      setVaultFolders(prev => [localFolder, ...prev]);
                    }}
                    onDeleteNote={(id) => {
                      setVaultNotes(prev => prev.filter(n => n.id !== id));
                      if (selectedNoteId === id) setSelectedNoteId(null);
                      if (currentUser?.uid) deleteVaultNoteFromSupabase(id, currentUser.uid).catch(() => {});
                      showNotification('Note removed from vault.');
                    }}
                    renderMarkdown={renderMarkdown}
                    showNotification={showNotification}
                  />


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
                          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                            {sidebarWinterCosmetics.equippedBanner && (
                              <div className="pointer-events-none absolute inset-0 opacity-45" aria-hidden="true">
                                <ProfileBannerBackdrop equippedBanner={sidebarWinterCosmetics.equippedBanner} className="w-full h-full" />
                                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/65 to-slate-950/80" />
                              </div>
                            )}
                            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5 p-5">
                              <ProfileCosmeticAvatar
                                name={currentUser?.name || 'User'}
                                avatarUrl={profileAvatar}
                                equippedBorder={sidebarWinterCosmetics.equippedBorder}
                                size="xl"
                                shape="rounded"
                                fallbackBgClass="bg-slate-800 text-indigo-400 font-black font-mono"
                              />
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
                              <p className="text-[10px] text-slate-400">Supports PNG, JPG, or WEBP images uploaded to secure school storage.</p>
                            </div>
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
                          saveAssignment(currentUser, { ...newHw, status: 'published' }, !hwEditId).catch(() => {});

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
                          const studentGrade = currentUser?.grade || 'Grade 10';
                          const sg = normG(studentGrade);
                          const hg = normG(hw.classGrade);
                          const ss = normS(currentUser?.section || 'A');
                          const hs = normS(hw.classSection);
                          const gradeMatches = !hg || hg === 'all' || hw.classGrade === 'All Grades' || sg === hg || hw.classGrade === studentGrade;
                          const secMatches = !hs || hs === 'all' || hw.classSection === 'All Sections' || !ss || ss === hs;
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
                            void recordEngagementActivity(currentUser, effectiveRole || 'student', 'homework', 1, {
                              title: 'Homework Completed',
                              subtitle: `Finished "${hw.title}".`,
                              ctaLabel: 'Open Homework',
                              actionTab: 'homework',
                              reason: 'Completed homework task',
                            });
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

                              {/* Bidirectional Note-to-Homework Integration */}
                              <HomeworkLinkedNotesSection
                                homework={hw}
                                notes={vaultNotes}
                                currentUserId={currentUser?.uid}
                                onOpenNote={(noteId) => {
                                  setSelectedNoteId(noteId);
                                  setActiveTab('notes');
                                  showNotification('Opened linked lecture note!');
                                }}
                                onCreateNoteForHomework={(targetHw) => {
                                  const newId = 'note-hw-' + Date.now();
                                  const newNote: VaultNote = {
                                    id: newId,
                                    title: `Study Notes: ${targetHw.title}`,
                                    subject: targetHw.subject || 'General',
                                    content: `# Study Notes: ${targetHw.title}\n\n**Linked Homework**: ${targetHw.title} (${targetHw.subject})\n**Due Date**: ${targetHw.dueDate}\n\n## Assignment Summary\n${targetHw.content}\n\n---\n\n## Theoretical Concepts & Key Formulas\n\n- Write key ideas here...\n`,
                                    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                                    icon: '📓',
                                    coverBg: 'bg-gradient-to-r from-indigo-600 to-violet-900',
                                    userId: currentUser?.uid || 'guest'
                                  };
                                  setVaultNotes(prev => [newNote, ...prev]);
                                  setSelectedNoteId(newId);
                                  saveVaultNoteToSupabase(newNote, currentUser?.uid).catch(() => {});
                                  import('./lib/lectureNotes/homeworkLinks').then(({ linkNoteToHomework }) => {
                                    linkNoteToHomework(
                                      { id: newNote.id, title: newNote.title, subject: newNote.subject },
                                      { id: targetHw.id, title: targetHw.title, subject: targetHw.subject, dueDate: targetHw.dueDate },
                                      currentUser?.uid || 'guest'
                                    );
                                  });
                                  setActiveTab('notes');
                                  showNotification(`Created and linked new note for "${targetHw.title}"!`);
                                }}
                                onShowNotification={showNotification}
                              />

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
                                <div className="p-4 bg-slate-900 border border-white/5 rounded-xl text-xs space-y-3 font-serif min-h-[220px] max-h-[285px] text-slate-350 leading-relaxed overflow-y-auto">
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
                <FeedbackBoard
                  currentUser={currentUser}
                  effectiveRole={(effectiveRole as UserRole) || 'student'}
                  feedbackPosts={feedbackPosts}
                  handleAddFeedback={async (newPost) => {
                    const uid = currentUser?.uid || 'guest';
                    let insertedRow: any = null;
                    try {
                      const { data, error } = await supabase
                        .from('feedback_posts')
                        .insert({
                          user_id: uid,
                          user_name: newPost.author || currentUser?.name || 'Veylentra Member',
                          user_role: newPost.role || currentUser?.role || 'student',
                          title: newPost.title || 'Campus Suggestion',
                          body: newPost.text || '',
                          category: newPost.category || 'suggestion',
                          status: 'open'
                        })
                        .select()
                        .maybeSingle();
                      if (data) insertedRow = data;
                    } catch (err) {
                      console.warn('[Feedback Insert Supabase]', err);
                    }

                    const createdPost: FeedbackPost = {
                      id: insertedRow?.id || `fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                      author: insertedRow?.user_name || newPost.author,
                      authorId: insertedRow?.user_id || uid,
                      role: insertedRow?.user_role || newPost.role,
                      category: insertedRow?.category || newPost.category,
                      title: insertedRow?.title || newPost.title,
                      text: insertedRow?.body || newPost.text,
                      votes: 1,
                      upvotedBy: [uid],
                      status: insertedRow?.status || 'open',
                      replies: [],
                      createdAt: insertedRow?.created_at || new Date().toISOString()
                    };
                    const updated = [createdPost, ...feedbackPosts];
                    setFeedbackPosts(updated);
                    saveFeedbacksToSupabase(updated);
                    showNotification('🚀 Published suggestion on Feedback Board!');
                  }}
                  upvoteFeedback={async (id) => {
                    let nextVotes = 0;
                    let nextUpvotedBy: string[] = [];
                    const updated = feedbackPosts.map(post => {
                      if (post.id === id) {
                        const uid = currentUser?.uid || 'guest';
                        const upvotedBy = post.upvotedBy || [];
                        const hasUpvoted = upvotedBy.includes(uid);
                        nextVotes = hasUpvoted ? Math.max(0, post.votes - 1) : post.votes + 1;
                        nextUpvotedBy = hasUpvoted ? upvotedBy.filter(u => u !== uid) : [...upvotedBy, uid];
                        return {
                          ...post,
                          votes: nextVotes,
                          upvotedBy: nextUpvotedBy
                        };
                      }
                      return post;
                    });
                    setFeedbackPosts(updated);
                    saveFeedbacksToSupabase(updated);
                    try {
                      await supabase.from('feedback_posts').update({
                        votes: nextVotes,
                        upvoted_by: nextUpvotedBy
                      }).eq('id', id);
                    } catch (_) {}
                  }}
                  handleFacultyStatusUpdate={async (id, status) => {
                    const updated = feedbackPosts.map(post => post.id === id ? { ...post, status } : post);
                    setFeedbackPosts(updated);
                    saveFeedbacksToSupabase(updated);
                    try {
                      await supabase.from('feedback_posts').update({
                        status
                      }).eq('id', id);
                    } catch (err) {
                      console.warn('[Feedback Status Update]', err);
                    }
                    showNotification(`Status updated to ${status}`);
                  }}
                  handleAddReply={async (postId, replyText) => {
                    let updatedReplies: any[] = [];
                    const updated = feedbackPosts.map(post => {
                      if (post.id === postId) {
                        updatedReplies = [
                          ...(post.replies || []),
                          {
                            author: currentUser?.name || 'Faculty Member',
                            role: effectiveRole || 'teacher',
                            text: replyText,
                            createdAt: new Date().toISOString()
                          }
                        ];
                        return {
                          ...post,
                          replies: updatedReplies
                        };
                      }
                      return post;
                    });
                    setFeedbackPosts(updated);
                    saveFeedbacksToSupabase(updated);
                    try {
                      await supabase.from('feedback_posts').update({
                        replies: updatedReplies
                      }).eq('id', postId);
                    } catch (_) {}
                    showNotification('Official response added.');
                  }}
                />
              )}
              {/* Tab 7: Byte AI Role-Aware Workspace */}
              {activeTab === 'ai_teacher' && (
                <ByteWorkspace
                  currentUser={currentUser}
                  effectiveRole={effectiveRole}
                  activeTab={activeTab}
                  aiThreads={aiThreads}
                  activeThread={activeThread}
                  activeThreadId={activeThreadId}
                  setActiveThreadId={setActiveThreadId}
                  showAiHistoryDrawer={showAiHistoryDrawer}
                  setShowAiHistoryDrawer={setShowAiHistoryDrawer}
                  selectedPersona={selectedPersona}
                  aiMode={aiMode}
                  aiReasoningMode={aiReasoningMode}
                  setAiReasoningMode={setAiReasoningMode}
                  aiWebSearchMode={aiWebSearchMode}
                  setAiWebSearchMode={setAiWebSearchMode}
                  aiModelOverride={aiModelOverride}
                  setAiModelOverride={setAiModelOverride}
                  aiUsageState={aiUsageState}
                  setShowQuotaModal={setShowQuotaModal}
                  aiLoading={aiLoading}
                  aiStatusMessage={aiStatusMessage}
                  aiGroundedInData={aiGroundedInData}
                  aiActiveModelLabel={aiActiveModelLabel}
                  aiInput={aiInput}
                  setAiInput={setAiInput}
                  attachedFiles={attachedFiles}
                  setAttachedFiles={setAttachedFiles}
                  aiFileInputRef={aiFileInputRef}
                  aiAbortControllerRef={aiAbortControllerRef}
                  speakingMsgIdx={speakingMsgIdx}
                  byteThreadContext={byteThreadContext}
                  aiThreadHoldMenu={aiThreadHoldMenu}
                  setIsJarvisActive={setIsJarvisActive}
                  setSelectedTopicForTutor={setSelectedTopicForTutor}
                  onNavigateTab={handleTabSelect}
                  handleCreateNewThread={handleCreateNewThread}
                  handleSwitchPersona={handleSwitchPersona}
                  handleSwitchMode={handleSwitchMode}
                  handleClearThreadHistory={handleClearThreadHistory}
                  handleAskAIModel={handleAskAIModel}
                  handleCopyToClipboard={handleCopyToClipboard}
                  handleSaveToNotes={handleSaveToNotes}
                  handleToggleSpeakMessage={handleToggleSpeakMessage}
                  handleFileUploadAction={handleFileUploadAction}
                  handleRemoveAttachedFile={handleRemoveAttachedFile}
                  showNotification={showNotification}
                />
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

              {/* Tab 9: Modern Faculty Center 2.0 (Teacher, Coordinator, HOD & Admin Workspaces) */}
              {activeTab === 'faculty' && isFacultyRole(effectiveRole) && (
                <FacultyExperienceWorkspace
                  currentUser={currentUser}
                  effectiveRole={effectiveRole}
                  homeworkList={homeworkList}
                  announcements={announcements}
                  onNavigateTab={handleTabSelect}
                  onOpenOrionFull={(query) => {
                    setOrionInitialQuery(query || '');
                    setIsJarvisActive(true);
                  }}
                  showNotification={showNotification}
                />
              )}
              {false && activeTab === 'faculty' && effectiveRole === 'teacher' && (() => {
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
                <AdminCenter
                  currentUser={currentUser}
                  showNotification={showNotification}
                  initialSubTab={selectedAdminSubTab}
                />
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
                          streakDays: 0,
                          quizzesTaken: 0,
                          studyHours: 0
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
                  streakDays: 0,
                  quizzesTaken: 0,
                  studyHours: 0
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

              {/* Tab: Role-Separated XP Leaderboard */}
              {activeTab === 'leaderboard' && currentUser && (
                canViewLeaderboardTab ? (
                  <div className="space-y-4">
                    {(isSuperAdminRole(currentUser?.role) || isSuperAdminRole(effectiveRole)) && (
                      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-slate-900/80 border border-slate-800 w-fit">
                        {studentLbAccess.accessible && (
                          <button
                            type="button"
                            onClick={() => setLeaderboardTabView('student')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              leaderboardTabView === 'student'
                                ? 'bg-sky-600 text-white'
                                : 'text-slate-300 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            Student Leaderboard
                          </button>
                        )}
                        {facultyLbAccess.accessible && (
                          <button
                            type="button"
                            onClick={() => setLeaderboardTabView('faculty')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              leaderboardTabView === 'faculty'
                                ? 'bg-sky-600 text-white'
                                : 'text-slate-300 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            Faculty Leaderboard
                          </button>
                        )}
                      </div>
                    )}
                    <StudentGamificationHub
                      currentUser={currentUser}
                      leaderboardType={
                        isSuperAdminRole(currentUser?.role) || isSuperAdminRole(effectiveRole)
                          ? leaderboardTabView
                          : isFacultyRoleForLb
                            ? 'faculty'
                            : 'student'
                      }
                      initialSection="leaderboard"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center space-y-2">
                    <Shield className="w-8 h-8 text-slate-400 mx-auto" />
                    <h3 className="text-base font-bold text-white">XP Leaderboard Unavailable</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      This leaderboard is currently disabled by your Super Admin in Feature & Theme Management.
                    </p>
                  </div>
                )
              )}

              {/* Tab: Winter Festival Hub */}
              {activeTab === 'winter_festival' && currentUser && (
                canViewWinterHub ? (
                  <WinterFestivalHub
                    currentUser={currentUser}
                    showNotification={showNotification}
                    onNavigateTab={handleTabSelect}
                  />
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center space-y-2">
                    <Shield className="w-8 h-8 text-slate-400 mx-auto" />
                    <h3 className="text-base font-bold text-white">Winter Festival Unavailable</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Winter Festival features are currently disabled by your Super Admin.
                    </p>
                  </div>
                )
              )}

                </motion.div>
              </AnimatePresence>
            </main>

            {/* Mobile Bottom Navigation Bar (Phones < 768px & Installed Mobile PWA) */}
            {!presentationMode && activeTab !== 'whiteboard' && (
              <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-2 pt-1.5 pb-2 safe-area-pb flex items-center justify-around gap-1">
                {[
                  { id: 'dashboard', label: 'Home', icon: <VeylentraIcon name="dashboard" size="sm" /> },
                  { id: 'study_hub', label: 'Study', icon: <VeylentraIcon name="study_hub" size="sm" />, badge: dueCardsCount > 0 ? dueCardsCount : 0 },
                  { id: 'peer_chat', label: 'Chat', icon: <VeylentraIcon name="peer_chat" size="sm" /> },
                  { id: 'ai_teacher', label: 'Byte', icon: <VeylentraIcon name="byte" size="sm" /> },
                ].map((item) => {
                  const isActive = item.id === 'study_hub'
                    ? ['study_hub', 'tasks', 'planner', 'flashcards'].includes(activeTab)
                    : activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleTabSelect(item.id)}
                      className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-lg flex-1 min-w-0 min-h-[44px] transition-colors cursor-pointer ${
                        isActive
                          ? 'text-white bg-blue-600 font-semibold shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 font-medium'
                      }`}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <span className="text-[10px] mt-1 leading-none tracking-tight truncate max-w-full">{item.label}</span>
                      {item.badge ? (
                        <span className="absolute top-1 right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-rose-500 text-white text-[8px] font-bold font-mono flex items-center justify-center leading-none">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg flex-1 min-w-0 min-h-[44px] transition-colors cursor-pointer ${
                    sidebarOpen ? 'text-white bg-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-200 font-medium'
                  }`}
                >
                  <Menu className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] mt-1 leading-none tracking-tight truncate max-w-full">Menu</span>
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
                    onClose={() => {
                      setIsJarvisActive(false);
                      setOrionInitialQuery('');
                    }}
                    activeTab={activeTab}
                    initialQuery={orionInitialQuery}
                    modelOverride={aiModelOverride || undefined}
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

      <BroadcastModal
        currentUser={currentUser}
        effectiveRole={effectiveRole}
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
        showNotification={showNotification}
      />

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



      {isSoundSettingsModalOpen && (
        <SoundSettingsModal
          isOpen={isSoundSettingsModalOpen}
          onClose={() => setIsSoundSettingsModalOpen(false)}
        />
      )}

      {/* Major Release Announcement Banner (Only for authenticated users; never on sign up / login) */}
      {Boolean(currentUser) && (
        <MajorReleaseBanner
          currentUser={currentUser}
          effectiveRole={effectiveRole}
          onNavigateTab={handleTabSelect}
        />
      )}

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
                  void recordEngagementActivity(currentUser, effectiveRole || 'student', 'study_session', 1, {
                    title: 'Byte Topic Mastery',
                    subtitle: `Mastered "${top}" with Byte AI.`,
                    ctaLabel: 'Open Study Hub',
                    actionTab: 'study_hub',
                    reason: 'Mastered topic with Byte AI',
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

      {/* Persistent Floating Spin Wheel Launcher positioned cleanly above Byte */}
      {currentUser && !isOnboardingModalOpen && (
        <FloatingSpinWheelButton
          currentUser={currentUser}
          showNotification={showNotification}
        />
      )}

      {/* Floating Byte Companion — hidden on auth / sign up page */}
      {currentUser && !isOnboardingModalOpen && (
        <FloatingByteWidget
          activeTab={activeTab}
          currentUser={currentUser}
          effectiveRole={effectiveRole}
          tasks={tasks}
          homeworkList={homeworkList}
          assessments={connectedAssessments}
          announcements={announcements}
          dueCardsCount={dueCardsCount}
          onNavigateTab={handleTabSelect}
          onOpenByteOrionModal={(mode) => {
            setByteOrionModalMode(mode || 'select');
            setIsByteOrionModalOpen(true);
          }}
        />
      )}

      {/* 3-Second Long Press Byte / Orion Assistant Modal */}
      {isByteOrionModalOpen && currentUser && (
        <ByteOrionAssistantModal
          isOpen={isByteOrionModalOpen}
          onClose={() => setIsByteOrionModalOpen(false)}
          initialMode={byteOrionModalMode}
          currentUser={currentUser}
          effectiveRole={effectiveRole}
          onNavigateTab={handleTabSelect}
          onOpenOrionFull={(query) => {
            setOrionInitialQuery(query || '');
            setIsJarvisActive(true);
          }}
          showNotification={showNotification}
          reminders={buildByteReminders({
            currentUser,
            effectiveRole,
            homeworkList,
            assessments: connectedAssessments,
            tasks,
            announcements,
            dueCardsCount
          })}
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

      {/* AI Thread Hold / Context Menu */}
      {aiThreadHoldMenu && (() => {
        const targetThread = aiThreads.find(t => t.id === aiThreadHoldMenu.threadId);
        return (
          <NativeContextMenu
            isOpen={true}
            x={aiThreadHoldMenu.x}
            y={aiThreadHoldMenu.y}
            menuWidth={216}
            menuHeight={196}
            ariaLabel={`Actions for ${targetThread?.title || 'Chat Session'}`}
            headerTitle={targetThread?.title || 'Chat Session'}
            headerSubtitle={targetThread?.mode ? `${targetThread.mode} mode` : 'Byte Study Thread'}
            menuRef={byteThreadMenuRef}
            isInteractionGuarded={byteThreadContext.isInteractionGuarded}
            onClose={() => {
              setByteDeleteConfirmId(null);
              setAiThreadHoldMenu(null);
            }}
            zIndexBackdrop={209}
            zIndexMenu={210}
            className="w-54"
          >
            <div className="flex flex-col gap-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (byteThreadContext.isInteractionGuarded()) return;
                  handlePinThread(aiThreadHoldMenu.threadId);
                }}
                className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
              >
                <Pin className="w-3.5 h-3.5 text-amber-400" />
                {targetThread?.isPinned ? 'Unpin Session' : 'Pin Session'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (byteThreadContext.isInteractionGuarded()) return;
                  handleRenameThread(aiThreadHoldMenu.threadId);
                }}
                className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                Rename
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (byteThreadContext.isInteractionGuarded()) return;
                  if (byteDeleteConfirmId === aiThreadHoldMenu.threadId) {
                    handleDeleteThread(aiThreadHoldMenu.threadId);
                    setByteDeleteConfirmId(null);
                  } else {
                    setByteDeleteConfirmId(aiThreadHoldMenu.threadId);
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  byteDeleteConfirmId === aiThreadHoldMenu.threadId
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {byteDeleteConfirmId === aiThreadHoldMenu.threadId ? 'Confirm Delete Session' : 'Delete Session'}
              </button>
            </div>
          </NativeContextMenu>
        );
      })()}

      {/* Rename Byte AI Thread Modal */}
      {renamingByteThread && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setRenamingByteThread(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Edit2 className="w-4 h-4" />
                <span>Rename Study Session</span>
              </div>
              <button
                type="button"
                onClick={() => setRenamingByteThread(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={renamingByteThread.title}
              onChange={(e) => setRenamingByteThread(prev => prev ? { ...prev, title: e.target.value } : null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renamingByteThread.title.trim()) {
                  void handleConfirmRenameByteThread();
                } else if (e.key === 'Escape') {
                  setRenamingByteThread(null);
                }
              }}
              placeholder="Enter session title..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingByteThread(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!renamingByteThread.title.trim()}
                onClick={() => void handleConfirmRenameByteThread()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Real-time Notification Flyout with Per-User Throttling & Lifecycle Guards */}
      <NotificationFlyout
        notifications={notifications}
        currentUserId={currentUser?.uid}
        effectiveRole={effectiveRole}
        userGrade={currentUser?.grade}
        userSection={currentUser?.section}
        maxVisible={engagementOverview?.policy?.maxVisibleFlyouts ?? 1}
        cooldownSeconds={engagementOverview?.policy?.flyoutCooldownSeconds ?? 45}
        onNavigateTab={(tab) => handleTabSelect(tab)}
        onMarkAsRead={(id) => handleMarkAsRead(id)}
        onDismiss={(id) => handleDeleteNotif(id)}
      />

      {/* AI Lecture Notes Synthesizer and Transformer Modal */}
      {(() => {
        const activeNote = vaultNotes.find(n => n.id === selectedNoteId);
        return (
          <LectureNotesAiModal
            isOpen={notesAiModalOpen}
            mode={notesAiModalMode}
            initialSubject={activeNote?.subject || 'Computer Science'}
            noteTitle={activeNote?.title || 'Lecture Note'}
            currentContent={activeNote?.content || ''}
            selectedText={notesAiSelectedText}
            onClose={() => setNotesAiModalOpen(false)}
            onSaveNewNote={handleSaveAiNewNote}
            onApplyEdit={handleApplyAiEdit}
            renderMarkdown={renderMarkdown}
          />
        );
      })()}

      {/* Global Winter Seasonal Badge Unlock Celebration Modal */}
      {currentUser && !isLocked && (
        <BadgeUnlockCelebrationModal
          currentUserId={currentUser.uid}
          onViewCollection={() => {
            handleTabSelect('winter_festival');
            setTimeout(() => {
              const target = document.getElementById('winter-badges-showcase');
              target?.scrollIntoView({
                behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                block: 'start',
              });
            }, 140);
          }}
        />
      )}

      {/* Global Scholar Level-Up & Regular Academic Badge Celebration Overlays */}
      {currentUser && !isLocked && (
        <>
          <LevelUpCelebrationModal
            currentUserId={currentUser.uid}
            onViewRoadmap={() => handleTabSelect('leaderboard')}
          />
          <RegularBadgeUnlockModal
            currentUserId={currentUser.uid}
            onViewCollection={() => handleTabSelect('leaderboard')}
          />
          <StreakRecoveryCelebrationModal
            currentUserId={currentUser.uid}
            onContinue={() => refreshEngagementOverview()}
          />
        </>
      )}

    </div>
  );

}
