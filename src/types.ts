/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'student' | 'teacher' | 'coordinator' | 'admin' | 'super_admin';

export type HouseType = 'Ruby' | 'Emerald' | 'Sapphire' | 'Topaz';
export type SectionType = 'Astra' | 'Elara' | 'Solara' | 'Vega';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'holiday';

export interface AttendanceRecord {
  id?: string;
  date: string; // YYYY-MM-DD
  grade: string;
  section: string;
  studentId: string;
  studentName?: string;
  status: AttendanceStatus;
  updatedAt?: string;
  updatedBy?: string;
}

export interface UserProfile {
  email: string;
  name: string;
  role: UserRole;
  uid?: string;
  requestedRole?: 'student' | 'teacher' | 'coordinator' | 'admin';
  accountStatus?: 'approved' | 'rejected' | 'pending_teacher' | 'pending_coordinator' | 'pending_admin' | 'active';
  grade?: string; // e.g. "Grade 10"
  section?: SectionType;
  house?: HouseType;
  rollNumber?: string;
  phone?: string;
  birthdate?: string;
  department?: string;
  subjects?: string[];
  designation?: string;
  specialtySubject?: string; // For teachers
  assignedGrades?: string[]; // Deprecated, use assignedClasses
  assignedSections?: string[]; // Deprecated, use assignedClasses
  assignedClasses?: string[]; // Format: "{Grade}_{Section}" e.g. "Grade 9_Section A"
  avatar?: string;
  photoURL?: string;
  bannerUrl?: string;
  bannerPreset?: string;
  bio?: string;
  pronouns?: string;
  customStatus?: string;
  avatarFrame?: string;
  accentColor?: string;
  badges?: string[];
  unlockedFrames?: string[];
  lastLogin?: number;
  studyHours?: number;
  quizzesTaken?: number;
  streakDays?: number;
  pin?: string;
  grant_all_permissions?: boolean;
  permissions?: string[];
  enableWebPush?: boolean;
  fcmToken?: string;
  fcmDeviceId?: string;
  raw_data?: any;
}

export type ProfileFrameStyle =
  | 'none'
  | 'neon-cyber'
  | 'gold-championship'
  | 'emerald-scholar'
  | 'ruby-flame'
  | 'sapphire-galaxy'
  | 'topaz-spark'
  | 'pixel-retro'
  | 'rainbow-holo';

export type CalendarEventType =
  | 'EXAM'
  | 'TEST'
  | 'ASSIGNMENT'
  | 'HOLIDAY'
  | 'SCHOOL_EVENT'
  | 'COMPETITION'
  | 'MEETING'
  | 'OTHER';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO or YYYY-MM-DDTHH:mm
  endTime: string;
  eventType: CalendarEventType;
  category?: string;
  color?: string;
  audience: 'all' | 'students' | 'teachers' | 'coordinators';
  classGrade?: string;
  classSection?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
}

export type AssessmentType =
  | 'Quiz'
  | 'Assignment'
  | 'Unit Test'
  | 'Periodic Test'
  | 'Midterm'
  | 'Project'
  | 'Practical'
  | 'Final Exam'
  | 'Other';

export interface GradebookAssessment {
  id: string;
  title: string;
  classGrade: string;
  classSection: string;
  subject: string;
  period: string;
  type: AssessmentType;
  maxScore: number;
  date: string;
  teacherId: string;
  teacherName?: string;
  createdAt?: string;
}

export interface GradebookEntry {
  id: string;
  assessmentId: string;
  studentId: string;
  studentName: string;
  subject: string;
  score: number;
  maxScore: number;
  percentage: number;
  letterGrade: string;
  comment?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type ReportCardStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED';

export interface ReportCardSubject {
  subject: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  letterGrade: string;
  teacherComment?: string;
}

export interface ReportCard {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  rollNumber?: string;
  classGrade: string;
  classSection: string;
  house?: HouseType;
  academicPeriod: string;
  status: ReportCardStatus;
  subjects: ReportCardSubject[];
  totalMarks: number;
  maxTotalMarks: number;
  overallPercentage: number;
  overallGrade: string;
  gpa?: number;
  rank?: string;
  attendanceSummary?: {
    totalDays: number;
    presentDays: number;
    percentage: number;
  };
  teacherRemarks?: string;
  principalRemarks?: string;
  conductGrade?: string;
  generatedAt: string;
  publishedAt?: string;
  updatedBy?: string;
}

export interface RecentAccount {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: string;
  lastLogin: number;
}

export interface QuizResult {
  id?: string;
  quizId?: string;
  studentEmail: string;
  score: number;
  totalQuestions: number;
  timestamp?: string;
}

export interface HouseStats {
  points: number;
  rank: number;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  category?: string;
  dueDate?: string;
  subject?: string;
  userId?: string;
  createdAt?: string;
}

export interface ScheduleItem {
  id: string;
  subject: string;
  time: string;
  day: string; // e.g., "Monday"
}

export interface VaultNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  subject: string;
  icon?: string; // e.g. "📝", "💡", "🧪"
  coverBg?: string; // e.g. "bg-gradient-to-r from-blue-600 to-indigo-900"
  userId?: string;
}

export interface Homework {
  id: string;
  classGrade: string; // e.g. "Grade 1" to "Grade 12"
  classSection: SectionType | 'All Sections'; // Target section or broadcast to all
  subject: string;
  title: string;
  content: string; // supports Markdown instructions
  dueDate: string;
  givenBy: string;
  createdAt: string;
  completedList: string[]; // array of student emails who checked this homework
}

export interface Lesson {
  id: string;
  title: string;
  subject: string;
  presentedBy: string;
  slides: string[]; // text content of each slide
  currentSlideIndex: number;
  isActive: boolean;
  smartBoardNotes?: string;
  targetGrade?: string;
  targetSection?: string;
}

export interface FeedbackPost {
  id: string;
  author: string;
  authorId?: string; // Add authorId
  role: UserRole;
  text: string;
  votes: number;
  upvotedBy?: string[]; // Add upvotedBy tracking
  replies: { author: string; role: UserRole; text: string; createdAt: string }[];
  category: 'facilities' | 'academic' | 'events' | 'other';
  status: 'pending' | 'in-progress' | 'solved' | 'planned';
  createdAt: string;
}

export type ResourceCategory = 'material' | 'timetable' | 'assignment' | 'worksheet' | 'notice' | 'homework' | 'gallery';

export interface MaterialResource {
  id: string;
  title: string;
  subject: string; // "Mathematics" | "Physics" | "Chemistry" | "Biology" | "English" | "Computer Science" | "Social Science" | "General"
  category?: ResourceCategory; // Added this, optional for backward compatibility
  type: 'pdf' | 'link' | 'image' | 'formula-sheet' | 'ppt' | 'pptx' | 'doc' | 'docx' | 'notes' | 'assignment' | 'question-paper' | 'project' | 'text' | 'gallery-image';
  url?: string;
  fileUrl?: string;
  file_url?: string;
  attachment_url?: string;
  storagePath?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  description: string;
  code?: string;
  uploadedBy: string; // Name of uploader
  uploaderUid?: string;
  uploaderHouse?: string;
  uploaderSection?: string;
  createdAt: string;
  created_at?: number | string;
  classGrade?: string; // Added this
  classSection?: SectionType | 'All Sections'; // Added this
  dueDate?: string; // Added this
  isPublic?: boolean;
  visibility?: 'student' | 'teacher' | 'private';
  visibleToGrades?: string[];
  visibleToSections?: string[];
  visibleToHouses?: string[];
  downloads?: number;
  likes?: number;
  likedBy?: string[]; // uids of users who liked this
  views?: number;
  isVerified?: boolean; // Teacher Verified
  comments?: {
    id: string;
    author: string;
    house?: string;
    text: string;
    createdAt: string;
  }[];
  questionPaperYear?: string; // e.g. "2025" or "2024" Or "Midterm"
  aiSummary?: string;
  aiQuiz?: string;
  aiExplain?: string;
  aiRevisionNotes?: string;
  aiImportantQuestions?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface ChatAttachment {
  type: 'image' | 'pdf' | 'audio' | 'video' | 'file';
  url: string;
  name: string;
  size?: string;
}

export interface ChatMessage {
  id: string;
  name: string;
  role: UserRole;
  house?: HouseType;
  message: string;
  createdAt: string;
  targetId?: string;
  sharedMaterialId?: string;
  senderId?: string;
  ownerUid?: string;
  replyToId?: string;
  replyToText?: string;
  replyToSender?: string;
  attachments?: ChatAttachment[];
  reactions?: Record<string, string[]>; // emoji -> userUids[]
  readBy?: string[];
  deliveredTo?: string[];
  isEdited?: boolean;
  editedAt?: string;
  isPinned?: boolean;
  deletedForEveryone?: boolean;
  deletedFor?: string[];
  flaggedReason?: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'group' | 'friend' | 'channel';
  channelCategory?: 'principal' | 'teacher' | 'class' | 'house' | 'club' | 'event';
  icon: string;
  description: string;
  code?: string;
  creatorId?: string;
  members?: string[];
  moderators?: string[];
  inviteExpiresAt?: string;
  isReadOnlyForStudents?: boolean;
  pinnedMessageIds?: string[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'assignment' | 'homework' | 'attendance' | 'exam' | 'marks' | 'feedback' | 'announcement' | 'chat' | 'mention' | 'ai_task' | 'substitute' | 'timetable' | 'resource' | 'blog' | 'reminder' | 'notice';
  createdAt: string;
  isRead: boolean;
  targetUserId?: string; // 'all' or user ID
  targetClass?: string;
  targetSection?: string;
  targetRole?: string;
  linkTab?: string;
}

export interface AITeacherPersona {
  id: string;
  name: string;
  speciality: string;
  style: string;
  systemPrompt: string;
  avatarChar: string;
  avatarColor: string;
}

export interface StudentReport {
  id: string; // usually UID or student ID
  name: string;
  classGrade: string;
  section: SectionType;
  house: HouseType;
  streakDays: number;
  materialsUploaded: number;
  notesCreated: number;
  quizzesCompleted: number;
  assignmentsCompleted: number;
  communityContributions: number;
  recentActivity: string[];
}

export interface HouseAnalytics {
  id: HouseType; // 'Ruby' | 'Emerald' | 'Sapphire' | 'Topaz'
  points: number;
  materialsShared: number;
  quizzesWon: number;
  participation: number; // custom score or attendance
}

export interface SectionAnalytics {
  id: SectionType; // 'Astra' | 'Elara' | 'Solara' | 'Vega'
  totalStudents: number;
  studyActivity: number; // e.g. average study hours
  quizScores: number; // average quiz percentage or count
  materialContributions: number;
}

export interface TeacherCommand {
  id: string;
  commandText: string;
  recognizedAt: string;
  parsedAction: string;
  status: 'success' | 'unknown' | 'error';
}

export interface JarvisHistoryItem {
  id: string;
  prompt: string;
  response: string;
  timestamp: string;
  senderName?: string;
  actionExecuted?: string;
}

// Phase 5 StudentOS Life Types
export type CompetitionCategory = 'Debate' | 'Quiz' | 'Coding' | 'Chess' | 'Drawing' | 'Science Fair' | 'Sports' | 'Robotics' | 'Olympiad' | 'Cultural' | 'Hackathon';

export interface Competition {
  id: string;
  title: string;
  description: string;
  category: CompetitionCategory;
  startDate: string;
  endDate: string;
  location: string;
  mode: 'Online' | 'Offline' | 'Hybrid';
  type: 'Individual' | 'Team';
  maxTeamSize?: number;
  eligibility: string;
  prizePool?: string;
  status: 'Upcoming' | 'Live' | 'Completed';
  createdBy: string;
  registeredCount: number;
  bannerUrl?: string;
  rules?: string[];
  schedule?: { time: string; event: string }[];
  winners?: { rank: number; name: string; house?: string; grade?: string; prize?: string }[];
  createdAt: string;
}

export interface CompetitionRegistration {
  id: string;
  competitionId: string;
  studentUid: string;
  studentName: string;
  studentEmail: string;
  grade?: string;
  house?: string;
  teamName?: string;
  teamMembers?: string[];
  registeredAt: string;
  certificateUrl?: string;
}

export interface HouseDetail {
  id: HouseType;
  name: string;
  color: string;
  points: number;
  rank: number;
  captain: string;
  viceCaptain?: string;
  motto: string;
  houseTeacher?: string;
  trophies: number;
  bannerUrl?: string;
}

export interface HouseAnnouncement {
  id: string;
  house: HouseType;
  title: string;
  content: string;
  postedBy: string;
  createdAt: string;
}

export interface Club {
  id: string;
  name: string; // e.g. "Coding Club", "Robotics Club", "Science Club", "Music Club", "Art Club", "Debate Club", "Literature Club"
  category: string;
  description: string;
  icon: string;
  leadTeacher: string;
  studentHead: string;
  memberCount: number;
  membersList?: string[]; // student UIDs/emails
  meetingDays: string;
  location: string;
  bannerUrl?: string;
}

export interface ClubActivity {
  id: string;
  clubId: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  completed?: boolean;
}

export interface StudentBadge {
  id: string;
  title: string; // e.g. "Top Performer", "Perfect Attendance", "Competition Winner", "Coding Champion", "Book Lover", "Artist", "Athlete"
  icon: string; // e.g. "🏆", "⭐", "🥇", "💻", "📚", "🎨", "🏃"
  category: string;
  awardedToUid: string;
  awardedToName: string;
  awardedBy: string;
  reason: string;
  awardedAt: string;
}

export interface SchoolEvent {
  id: string;
  title: string;
  category: 'Holiday' | 'Exam' | 'Competition' | 'Parent Meeting' | 'Sports Day' | 'Annual Day' | 'Cultural' | 'Birthday' | 'Deadline';
  date: string; // YYYY-MM-DD
  time?: string;
  location?: string;
  description: string;
  createdBy?: string;
}

export interface GalleryPhoto {
  id: string;
  albumId: string;
  title: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  likes?: number;
}

export interface GalleryAlbum {
  id: string;
  title: string;
  category: 'Events' | 'Sports' | 'Annual Day' | 'Trips' | 'Functions' | 'Celebrations' | 'Competitions';
  coverUrl: string;
  photoCount: number;
  createdAt: string;
  photos?: GalleryPhoto[];
}

export interface SchoolNews {
  id: string;
  title: string;
  category: 'News' | 'Success Story' | 'Announcement' | 'Achievement';
  content: string;
  author: string;
  imageUrl?: string;
  publishedAt: string;
  featured?: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  votedUserUids?: string[];
}

export interface SchoolPoll {
  id: string;
  question: string;
  category: 'Best House' | 'Event Feedback' | 'Student Council Elections' | 'General Class Poll';
  options: PollOption[];
  totalVotes: number;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
  userVotedOptionId?: string;
}

export interface EngagementGame {
  id: string;
  title: string;
  type: 'Quiz Battle' | 'Rapid Fire' | 'Spin Wheel' | 'Random Student Picker' | 'Poll Battle' | 'True/False' | 'Guess Image' | 'Memory Game' | 'Word Chain' | 'Dice Roll';
  hostedBy: string;
  activeQuestion?: string;
  options?: string[];
  timerSeconds?: number;
  status: 'Waiting' | 'Live' | 'Ended';
  participantsCount: number;
  scores?: { name: string; score: number }[];
}

export interface Meeting {
  id: string; // Secure Meeting ID (e.g. "meet-892-412-890")
  title: string;
  subject: string;
  className?: string; // e.g. "Grade 10" or "Grade 10 - Astra"
  batch?: string; // e.g. "Batch 2026"
  type: 'instant' | 'scheduled' | 'recurring';
  startTime: string; // ISO string
  endTime: string; // ISO string
  description?: string;
  password?: string;
  hostId: string;
  hostName: string;
  hostEmail: string;
  hostRole: UserRole;
  joinLink: string;
  isLocked?: boolean;
  isMutedAll?: boolean;
  isCameraDisabledAll?: boolean;
  isChatDisabled?: boolean;
  isScreenShareDisabled?: boolean;
  isFileShareDisabled?: boolean;
  invitedUsers?: string[]; // list of emails or user uids
  invitedClasses?: string[]; // e.g. ["Grade 10_Astra"]
  isSchoolWide?: boolean; // Principal school-wide meeting
  status: 'upcoming' | 'live' | 'ended';
  createdAt: string;
  updatedAt: string;
}

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  userId: string;
  name: string;
  email: string;
  role: 'host' | 'co-host' | 'participant';
  userRole: UserRole;
  avatar?: string;
  status: 'waiting' | 'admitted' | 'rejected' | 'left' | 'removed';
  joinedAt: string;
  leftAt?: string;
  durationSeconds: number;
  isCameraOn: boolean;
  isMicOn: boolean;
  isHandRaised: boolean;
  isScreenSharing: boolean;
  currentBreakoutRoomId?: string;
  cameraActiveDuration: number; // in seconds
  micActiveDuration: number; // in seconds
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface MeetingChatMessage {
  id: string;
  meetingId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string;
  content: string;
  attachment?: {
    name: string;
    url: string;
    type: 'image' | 'pdf' | 'file';
    size?: number;
  };
  timestamp: string;
  isPrivate?: boolean;
  recipientId?: string;
}

export interface MeetingRecording {
  id: string;
  meetingId: string;
  title: string;
  hostName: string;
  url: string;
  durationSeconds: number;
  sizeBytes: number;
  createdAt: string;
  aiSummary?: string;
}

export interface MeetingBreakoutRoom {
  id: string;
  meetingId: string;
  name: string;
  assignedUserIds: string[];
}

export interface MeetingAttendanceReport {
  meetingId: string;
  meetingTitle: string;
  date: string;
  totalParticipants: number;
  participants: {
    userId: string;
    name: string;
    email: string;
    userRole: string;
    joinTime: string;
    leaveTime: string;
    totalDurationMinutes: number;
    cameraOnPercent: number;
    micActiveSeconds: number;
    attendedPercent: number;
  }[];
}

// ============================================================
// WHAT'S NEW & SYSTEM UPDATE LOGS ARCHITECTURE
// ============================================================

export type ReleaseStatus = 'DRAFT' | 'SCHEDULED' | 'RELEASING' | 'RELEASED' | 'CANCELLED';
export type DeploymentStatus = 'PENDING' | 'READY' | 'DEPLOYING' | 'DEPLOYED' | 'FAILED';
export type WhatsNewReleaseStatus = 'DRAFT' | 'READY' | 'PUBLISHED' | 'ARCHIVED';

export interface StudentOSRelease {
  id: string;
  release_id: string;
  version: string;
  title: string;
  description: string;
  content: string; // Release Notes & What's New content
  category: SystemUpdateCategory;
  status: ReleaseStatus;
  scheduled_release_at: string; // ISO string with timezone
  actual_released_at?: string; // ISO string
  deployment_status: DeploymentStatus;
  whats_new_status: WhatsNewReleaseStatus;
  audience_roles: (UserRole | 'all')[];
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  is_major?: boolean;
}

export type SystemUpdateCategory = 'feature' | 'improvement' | 'bugfix' | 'maintenance' | 'security';

export type SystemUpdateStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface SystemUpdate {
  id: string;
  version: string;
  title: string;
  summary: string;
  category: SystemUpdateCategory;
  content: string; // Rich Markdown formatted notes
  status: SystemUpdateStatus;
  audienceRoles: (UserRole | 'all')[];
  isMajorRelease?: boolean;
  actionUrl?: string; // e.g. 'meet', 'calendar', 'gradebook', 'materials' or URL
  actionLabel?: string; // e.g. "Launch Virtual Classroom"
  mediaUrls?: string[]; // Screenshots, previews
  authorId: string;
  authorName: string;
  authorRole?: string;
  scheduledPublishAt?: string; // ISO string with timezone
  publishedAt?: string; // ISO string
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  raw_data?: any;
}

export interface SystemUpdateRead {
  id: string;
  updateId: string;
  userId: string;
  readAt: string;
}

export interface SystemUpdateAuditLog {
  id: string;
  updateId: string;
  action: 'create' | 'edit' | 'schedule' | 'publish' | 'unpublish' | 'archive' | 'delete';
  actorId: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  details?: string;
}

// Spaced Repetition (SM-2) Flashcard & Study Center Types
export type FlashcardQuality = 0 | 1 | 2 | 3 | 4 | 5;

export type FlashcardState = 'new' | 'learning' | 'review' | 'mastered';

export interface FlashcardReviewLog {
  date: string;
  rating: number;
  interval: number;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint?: string;
  tags?: string[];
  interval: number; // days
  repetition: number;
  easeFactor: number; // minimum 1.3, standard 2.5
  nextReviewDate: string; // ISO date string
  lastReviewedDate?: string;
  state: FlashcardState;
  history?: FlashcardReviewLog[];
}

export interface FlashcardDeck {
  id: string;
  title: string;
  description: string;
  subject: string;
  color: string;
  icon: string;
  cardCount?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags?: string[];
  isFavorite?: boolean;
}

