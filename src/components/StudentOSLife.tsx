import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Calendar,
  Users,
  Award,
  Image as ImageIcon,
  Flame,
  Newspaper,
  Vote,
  Plus,
  Search,
  ChevronRight,
  CheckCircle,
  Sparkles,
  Clock,
  MapPin,
  Check,
  UserPlus,
  AlertCircle,
  Shield,
  Radio,
  Medal,
  Crown,
  X,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import {
  UserProfile,
  Competition,
  CompetitionCategory,
  Club,
  StudentBadge,
  SchoolEvent,
  GalleryAlbum,
  SchoolNews,
  SchoolPoll,
  HouseDetail,
} from '../types';
import {
  fetchCompetitions,
  createCompetition,
  fetchSchoolEvents,
  createSchoolEvent,
  fetchClubs,
  createClub,
  fetchBadges,
  awardBadge,
  fetchGallery,
  createGalleryAlbum,
  fetchHouses,
  updateHousePoints,
  fetchPolls,
  votePoll,
  createPoll,
  fetchNews,
  subscribeToLifeTable,
  canManageLifeContent,
} from '../lib/supabaseLife';
import { soundService } from '../lib/soundService';
import {
  MOTION_EASE,
  MOTION_DURATION,
  getStaggerContainerVariants,
  getItemRevealVariants,
  useReducedMotionPreference,
} from '../lib/motionSystem';
import {
  AnimatedDialog,
  AnimatedSkeleton,
  BackgroundBeams,
  NumberTicker,
} from './ui/animatedComponents';
import { VeylentraIcon } from './ui/VeylentraIcon';
import { CampusCoverArtwork, GalleryPlaceholderTile, LifeCategoryIcon } from './life/LifeVisuals';

interface StudentOSLifeProps {
  currentUser: UserProfile;
  onNavigateToTab?: (tab: string) => void;
  onTriggerOrionAction?: (command: string) => void;
}

type LifeTabId =
  | 'dashboard'
  | 'competitions'
  | 'leaderboards'
  | 'houses'
  | 'clubs'
  | 'calendar'
  | 'achievements'
  | 'gallery'
  | 'news'
  | 'polls';

const INITIAL_HOUSES: HouseDetail[] = [
  {
    id: 'Ruby',
    name: 'Red Ruby Lions',
    color: 'from-red-600 to-rose-900',
    points: 1450,
    rank: 1,
    captain: 'Aarav Sharma',
    viceCaptain: 'Ananya Gupta',
    motto: 'Courage, Honor & Victory',
    houseTeacher: 'Mr. Rajesh Verma',
    trophies: 12,
  },
  {
    id: 'Emerald',
    name: 'Green Emerald Falcons',
    color: 'from-emerald-600 to-teal-900',
    points: 1380,
    rank: 2,
    captain: 'Rohan Mehta',
    viceCaptain: 'Siddharth Rao',
    motto: 'Wisdom, Growth & Excellence',
    houseTeacher: 'Dr. Sunita Patel',
    trophies: 9,
  },
  {
    id: 'Sapphire',
    name: 'Blue Sapphire Dragons',
    color: 'from-blue-600 to-indigo-900',
    points: 1310,
    rank: 3,
    captain: 'Priya Nair',
    viceCaptain: 'Kavya Singh',
    motto: 'Strength, Loyalty & Truth',
    houseTeacher: 'Mrs. Deepa Roy',
    trophies: 8,
  },
  {
    id: 'Topaz',
    name: 'Yellow Topaz Phoenix',
    color: 'from-amber-500 to-yellow-800',
    points: 1240,
    rank: 4,
    captain: 'Vikram Joshi',
    viceCaptain: 'Diya Kapoor',
    motto: 'Radiance, Passion & Unity',
    houseTeacher: 'Mr. Amit Saxena',
    trophies: 7,
  },
];

const INITIAL_COMPETITIONS: Competition[] = [
  {
    id: 'comp-1',
    title: 'Inter-House Annual Hackathon 2026',
    description:
      'A 24-hour collaborative coding showcase to build innovative educational tools for students and teachers.',
    category: 'Coding',
    startDate: '2026-08-15',
    endDate: '2026-08-16',
    location: 'Main Computer Lab · Veylentra Space',
    mode: 'Hybrid',
    type: 'Team',
    maxTeamSize: 4,
    eligibility: 'Grades 8 - 12',
    prizePool: '₹25,000 + Tech Trophies & Merit Certificates',
    status: 'Live',
    createdBy: 'Computer Science Department',
    registeredCount: 42,
    rules: [
      'Teams of 2-4 students',
      'Open source tools permitted',
      'Original code only',
      'Final pitch in 5 mins',
    ],
    schedule: [
      { time: '10:00 AM', event: 'Keynote & Kickoff' },
      { time: '02:00 PM', event: 'Midway Mentor Check-in' },
      { time: '06:00 PM', event: 'Final Project Submission' },
    ],
    createdAt: '2026-08-01',
  },
  {
    id: 'comp-2',
    title: 'National Science & Robotics Exhibition',
    description:
      'Showcase working hardware models, IoT sensors, robotics automatons, and renewable energy prototypes.',
    category: 'Robotics',
    startDate: '2026-08-22',
    endDate: '2026-08-22',
    location: 'School Auditorium Ground',
    mode: 'Offline',
    type: 'Team',
    maxTeamSize: 3,
    eligibility: 'All Grades (6 - 12)',
    prizePool: 'Robotics Kits + Gold Medals',
    status: 'Upcoming',
    createdBy: 'Science Club',
    registeredCount: 28,
    rules: [
      'Working physical model required',
      'Safety regulations strictly enforced',
      'Poster presentation required',
    ],
    createdAt: '2026-08-02',
  },
  {
    id: 'comp-3',
    title: 'Grand Parliamentary Debate Championship',
    description:
      'Debate on contemporary global affairs, AI ethics, climate policy, and space exploration.',
    category: 'Debate',
    startDate: '2026-08-28',
    endDate: '2026-08-29',
    location: 'Seminar Hall 1',
    mode: 'Offline',
    type: 'Team',
    maxTeamSize: 2,
    eligibility: 'Grades 9 - 12',
    prizePool: 'Rotating Shield + Best Speaker Trophy',
    status: 'Upcoming',
    createdBy: 'Literary & Debate Club',
    registeredCount: 18,
    createdAt: '2026-08-03',
  },
  {
    id: 'comp-4',
    title: 'Inter-School Speed Chess Olympiad',
    description:
      'Rapid 10-minute Swiss league chess tournament testing strategy, foresight, and tactics.',
    category: 'Chess',
    startDate: '2026-08-05',
    endDate: '2026-08-05',
    location: 'Chess Room · Online Board',
    mode: 'Online',
    type: 'Individual',
    eligibility: 'All Students',
    prizePool: 'Chess Master Trophy & Certificates',
    status: 'Completed',
    createdBy: 'Sports Committee',
    registeredCount: 64,
    winners: [
      { rank: 1, name: 'Aarav Sharma', house: 'Ruby', grade: 'Grade 11', prize: 'Gold Medal + Trophy' },
      { rank: 2, name: 'Rohan Mehta', house: 'Emerald', grade: 'Grade 10', prize: 'Silver Medal' },
      { rank: 3, name: 'Kavya Singh', house: 'Sapphire', grade: 'Grade 12', prize: 'Bronze Medal' },
    ],
    createdAt: '2026-07-28',
  },
];

const INITIAL_CLUBS: Club[] = [
  {
    id: 'club-1',
    name: 'Coding & AI Club',
    category: 'Technology',
    description: 'Explore Web Development, Python, Machine Learning, and Competitive Programming.',
    icon: '💻',
    leadTeacher: 'Mr. Rajesh Verma',
    studentHead: 'Aarav Sharma',
    memberCount: 142,
    meetingDays: 'Every Tuesday & Thursday (3:30 PM)',
    location: 'Computer Lab 2',
  },
  {
    id: 'club-2',
    name: 'Robotics & Automation Club',
    category: 'STEM',
    description: 'Design Arduino, Raspberry Pi circuits, drones, and autonomous rover models.',
    icon: '🤖',
    leadTeacher: 'Dr. Sunita Patel',
    studentHead: 'Rohan Mehta',
    memberCount: 98,
    meetingDays: 'Every Wednesday (3:30 PM)',
    location: 'Robotics Tinkering Lab',
  },
  {
    id: 'club-3',
    name: 'Science & Astronomy Club',
    category: 'Science',
    description: 'Stargazing sessions, physics experiments, biology research, and rocket chemistry.',
    icon: '🧪',
    leadTeacher: 'Mr. Amit Saxena',
    studentHead: 'Ananya Gupta',
    memberCount: 115,
    meetingDays: 'Every Monday (3:30 PM)',
    location: 'Physics Lab',
  },
  {
    id: 'club-4',
    name: 'Symphony Music & Band Club',
    category: 'Arts',
    description: 'Instrumental training, vocal harmonies, school band rehearsals, and live concerts.',
    icon: '🎵',
    leadTeacher: 'Mrs. Deepa Roy',
    studentHead: 'Kavya Singh',
    memberCount: 86,
    meetingDays: 'Every Friday (3:30 PM)',
    location: 'Music Room',
  },
  {
    id: 'club-5',
    name: 'Fine Arts & Canvas Studio',
    category: 'Arts',
    description: 'Oil painting, digital art, sculpting, charcoal sketching, and mural projects.',
    icon: '🎨',
    leadTeacher: 'Ms. Neha Verma',
    studentHead: 'Diya Kapoor',
    memberCount: 74,
    meetingDays: 'Every Thursday (3:30 PM)',
    location: 'Art Studio',
  },
  {
    id: 'club-6',
    name: 'Literary & Debate Forum',
    category: 'Humanities',
    description: 'Public speaking, model UN, creative writing, poetry slams, and elocution.',
    icon: '📚',
    leadTeacher: 'Mrs. Suman Rao',
    studentHead: 'Priya Nair',
    memberCount: 104,
    meetingDays: 'Every Wednesday (3:30 PM)',
    location: 'Library Conference Room',
  },
];

const INITIAL_BADGES: StudentBadge[] = [
  {
    id: 'b-1',
    title: 'Top Performer',
    icon: '🏆',
    category: 'Academic',
    awardedToUid: 'u-1',
    awardedToName: 'Aarav Sharma',
    awardedBy: 'Principal Dr. V. K. Sharma',
    reason: 'Highest score in Term 1 Midterms and active peer tutoring.',
    awardedAt: '2026-08-01',
  },
  {
    id: 'b-2',
    title: 'Perfect Attendance',
    icon: '⭐',
    category: 'Discipline',
    awardedToUid: 'u-2',
    awardedToName: 'Rohan Mehta',
    awardedBy: 'Class Teacher Mr. Verma',
    reason: '100% attendance recorded for 3 consecutive months.',
    awardedAt: '2026-08-02',
  },
  {
    id: 'b-3',
    title: 'Competition Winner',
    icon: '🥇',
    category: 'Sports',
    awardedToUid: 'u-3',
    awardedToName: 'Kavya Singh',
    awardedBy: 'Sports Director Mr. Rawat',
    reason: '1st rank in Inter-School Chess Olympiad.',
    awardedAt: '2026-08-05',
  },
  {
    id: 'b-4',
    title: 'Coding Champion',
    icon: '💻',
    category: 'Technology',
    awardedToUid: 'u-4',
    awardedToName: 'Ananya Gupta',
    awardedBy: 'Coding Club Mentor',
    reason: 'Completed 50+ algorithm challenges on Veylentra Codepad.',
    awardedAt: '2026-08-04',
  },
  {
    id: 'b-5',
    title: 'Book Lover',
    icon: '📚',
    category: 'Library',
    awardedToUid: 'u-5',
    awardedToName: 'Priya Nair',
    awardedBy: 'Librarian Mrs. Kapoor',
    reason: 'Read and reviewed 15 classic literature books this session.',
    awardedAt: '2026-07-29',
  },
];

const INITIAL_EVENTS: SchoolEvent[] = [
  {
    id: 'ev-1',
    title: 'Independence Day Cultural Celebration & Flag Hoisting',
    category: 'Annual Day',
    date: '2026-08-15',
    time: '08:00 AM',
    location: 'Main School Ground',
    description: 'Flag hoisting ceremony, patriotic songs, drill display, and award distribution.',
  },
  {
    id: 'ev-2',
    title: 'Mid-Term Examination Series 2026',
    category: 'Exam',
    date: '2026-09-01',
    time: '09:00 AM',
    location: 'All Classrooms',
    description: 'Comprehensive mid-term exams across all grades 6 to 12.',
  },
  {
    id: 'ev-3',
    title: 'Parent-Teacher Meeting (PTM - Term 1)',
    category: 'Parent Meeting',
    date: '2026-08-30',
    time: '09:30 AM',
    location: 'Respective Classrooms',
    description: 'Discussion on academic progress, attendance, and holistic development.',
  },
  {
    id: 'ev-4',
    title: 'Inter-House Sports Festival 2026',
    category: 'Sports Day',
    date: '2026-08-25',
    time: '08:30 AM',
    location: 'Sports Complex',
    description: 'Track events, football, basketball, badminton, and house cheer competitions.',
  },
];

const INITIAL_GALLERY: GalleryAlbum[] = [
  {
    id: 'gal-1',
    title: 'Annual Cultural Fest & Musical Night',
    category: 'Annual Day',
    coverUrl: '',
    photoCount: 24,
    createdAt: '2026-07-20',
  },
  {
    id: 'gal-2',
    title: 'Inter-School Athletics Championship',
    category: 'Sports',
    coverUrl: '',
    photoCount: 18,
    createdAt: '2026-07-15',
  },
  {
    id: 'gal-3',
    title: 'Educational Science Trip to Space Center',
    category: 'Trips',
    coverUrl: '',
    photoCount: 32,
    createdAt: '2026-06-10',
  },
  {
    id: 'gal-4',
    title: 'Robotics Expo & AI Innovation Fair',
    category: 'Competitions',
    coverUrl: '',
    photoCount: 15,
    createdAt: '2026-07-02',
  },
];

const INITIAL_NEWS: SchoolNews[] = [
  {
    id: 'news-1',
    title: 'Veylentra Innovation Hub Wins National EdTech Excellence Award',
    category: 'Success Story',
    content:
      'Our school has been recognized as the top smart digital campus in the region for integrating AI-assisted learning, collaborative whiteboards, and real-time student analytics.',
    author: 'Principal Office',
    imageUrl: '',
    publishedAt: '2026-08-04',
    featured: true,
  },
  {
    id: 'news-2',
    title: 'Robotics Team Qualifies for International Championship in Tokyo',
    category: 'Achievement',
    content:
      'The school Robotics Club team "Astra Drones" scored 1st place in the zonal finals and will represent our campus at the International Robotics Summit.',
    author: 'Robotics Club Mentors',
    imageUrl: '',
    publishedAt: '2026-08-02',
    featured: false,
  },
];

const INITIAL_POLLS: SchoolPoll[] = [
  {
    id: 'poll-1',
    question: 'Which House performed best during the Inter-House Cultural Week?',
    category: 'Best House',
    options: [
      { id: 'opt-1', text: 'Red Ruby Lions', votes: 142 },
      { id: 'opt-2', text: 'Green Emerald Falcons', votes: 118 },
      { id: 'opt-3', text: 'Blue Sapphire Dragons', votes: 95 },
      { id: 'opt-4', text: 'Yellow Topaz Phoenix', votes: 80 },
    ],
    totalVotes: 435,
    createdBy: 'Student Council President',
    createdAt: '2026-08-03',
    isActive: true,
  },
  {
    id: 'poll-2',
    question: 'Preferred theme for Annual Day Function 2026?',
    category: 'Event Feedback',
    options: [
      { id: 'opt-21', text: 'Future Horizons & Space AI', votes: 210 },
      { id: 'opt-22', text: 'Cultural Heritage Tapestry', votes: 135 },
      { id: 'opt-23', text: 'Eco-Sustain & Planet Protection', votes: 98 },
    ],
    totalVotes: 443,
    createdBy: 'Cultural Coordinator',
    createdAt: '2026-08-01',
    isActive: true,
  },
];

const HOUSE_BAR_COLOR: Record<string, string> = {
  Ruby: 'bg-gradient-to-r from-rose-500 to-red-400',
  Emerald: 'bg-gradient-to-r from-emerald-500 to-teal-400',
  Sapphire: 'bg-gradient-to-r from-blue-500 to-indigo-400',
  Topaz: 'bg-gradient-to-r from-amber-500 to-yellow-400',
};

const HOUSE_ACCENT_TEXT: Record<string, string> = {
  Ruby: 'text-rose-400',
  Emerald: 'text-emerald-400',
  Sapphire: 'text-blue-400',
  Topaz: 'text-amber-400',
};

const CAMPUS_STANDINGS = [
  { rank: 1, name: 'Aarav Sharma', grade: 'Grade 11', house: 'Ruby', points: 2850, badge: 'Top Scholar', category: 'Academic' },
  { rank: 2, name: 'Rohan Mehta', grade: 'Grade 10', house: 'Emerald', points: 2640, badge: '100% Attendance', category: 'Attendance' },
  { rank: 3, name: 'Kavya Singh', grade: 'Grade 12', house: 'Sapphire', points: 2510, badge: 'Chess Champ', category: 'Competition' },
  { rank: 4, name: 'Ananya Gupta', grade: 'Grade 9', house: 'Ruby', points: 2380, badge: 'AI Innovator', category: 'Club' },
  { rank: 5, name: 'Priya Nair', grade: 'Grade 11', house: 'Topaz', points: 2210, badge: 'Debate Captain', category: 'Competition' },
  { rank: 6, name: 'Siddharth Rao', grade: 'Grade 10', house: 'Emerald', points: 2150, badge: 'Robotics Lead', category: 'Club' },
  { rank: 7, name: 'Diya Kapoor', grade: 'Grade 12', house: 'Topaz', points: 2090, badge: 'Master Artist', category: 'House' },
  { rank: 8, name: 'Vikram Joshi', grade: 'Grade 11', house: 'Sapphire', points: 1980, badge: 'Sports MVP', category: 'Sports' },
];

export const StudentOSLife: React.FC<StudentOSLifeProps> = ({
  currentUser,
  onTriggerOrionAction,
}) => {
  const prefersReduced = useReducedMotionPreference();
  const [activeTab, setActiveTab] = useState<LifeTabId>('dashboard');
  const [isLoadingLife, setIsLoadingLife] = useState<boolean>(true);
  const [lifeError, setLifeError] = useState<string | null>(null);

  const [competitions, setCompetitions] = useState<Competition[]>(() => {
    try {
      const saved = localStorage.getItem('studentos_competitions');
      return saved ? JSON.parse(saved) : INITIAL_COMPETITIONS;
    } catch {
      return INITIAL_COMPETITIONS;
    }
  });

  const [registeredCompIds, setRegisteredCompIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('studentos_registered_comps');
      return saved ? JSON.parse(saved) : ['comp-1'];
    } catch {
      return ['comp-1'];
    }
  });

  const [houses, setHouses] = useState<HouseDetail[]>(() => {
    try {
      const saved = localStorage.getItem('studentos_houses');
      return saved ? JSON.parse(saved) : INITIAL_HOUSES;
    } catch {
      return INITIAL_HOUSES;
    }
  });

  const [clubs, setClubs] = useState<Club[]>(() => {
    try {
      const saved = localStorage.getItem('studentos_clubs');
      return saved ? JSON.parse(saved) : INITIAL_CLUBS;
    } catch {
      return INITIAL_CLUBS;
    }
  });

  const [joinedClubIds, setJoinedClubIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('studentos_joined_clubs');
      return saved ? JSON.parse(saved) : ['club-1', 'club-3'];
    } catch {
      return ['club-1', 'club-3'];
    }
  });

  const [badges, setBadges] = useState<StudentBadge[]>(() => {
    try {
      const saved = localStorage.getItem('studentos_badges');
      return saved ? JSON.parse(saved) : INITIAL_BADGES;
    } catch {
      return INITIAL_BADGES;
    }
  });

  const [events, setEvents] = useState<SchoolEvent[]>(() => {
    try {
      const saved = localStorage.getItem('studentos_events');
      return saved ? JSON.parse(saved) : INITIAL_EVENTS;
    } catch {
      return INITIAL_EVENTS;
    }
  });

  const [polls, setPolls] = useState<SchoolPoll[]>(() => {
    try {
      const saved = localStorage.getItem('studentos_polls');
      return saved ? JSON.parse(saved) : INITIAL_POLLS;
    } catch {
      return INITIAL_POLLS;
    }
  });

  const [gallery, setGallery] = useState<GalleryAlbum[]>(INITIAL_GALLERY);
  const [newsList, setNewsList] = useState<SchoolNews[]>(INITIAL_NEWS);

  const loadAllLifeData = async (isInitial = false) => {
    if (isInitial) setIsLoadingLife(true);
    setLifeError(null);
    try {
      const activeUid = currentUser?.uid || (currentUser as any)?.id;
      const [comps, evs, clbs, bdgs, gal, hses, pls, nws] = await Promise.all([
        fetchCompetitions(),
        fetchSchoolEvents(),
        fetchClubs(),
        fetchBadges(),
        fetchGallery(),
        fetchHouses(),
        fetchPolls(activeUid),
        fetchNews(),
      ]);

      if (comps.length > 0) setCompetitions(comps);
      if (evs.length > 0) setEvents(evs);
      if (clbs.length > 0) setClubs(clbs);
      if (bdgs.length > 0) setBadges(bdgs);
      if (gal.length > 0) setGallery(gal);
      if (hses.length > 0) setHouses(hses);
      if (pls.length > 0) setPolls(pls);
      if (nws.length > 0) setNewsList(nws);
    } catch (err: any) {
      console.warn('Error fetching Supabase Life data:', err);
      setLifeError(err?.message || 'Unable to sync live campus data right now.');
    } finally {
      if (isInitial) setIsLoadingLife(false);
    }
  };

  useEffect(() => {
    loadAllLifeData(true);

    const unsubComp = subscribeToLifeTable('life_competitions', () => loadAllLifeData(false));
    const unsubEvent = subscribeToLifeTable('life_events', () => loadAllLifeData(false));
    const unsubClub = subscribeToLifeTable('life_clubs', () => loadAllLifeData(false));
    const unsubBadge = subscribeToLifeTable('life_achievements', () => loadAllLifeData(false));
    const unsubGallery = subscribeToLifeTable('life_gallery', () => loadAllLifeData(false));
    const unsubHouse = subscribeToLifeTable('life_houses', () => loadAllLifeData(false));
    const unsubPoll = subscribeToLifeTable('life_polls', () => loadAllLifeData(false));

    return () => {
      unsubComp();
      unsubEvent();
      unsubClub();
      unsubBadge();
      unsubGallery();
      unsubHouse();
      unsubPoll();
    };
  }, []);

  // Filters
  const [compCategoryFilter, setCompCategoryFilter] = useState<string>('All');
  const [compStatusFilter, setCompStatusFilter] = useState<'All' | 'Live' | 'Upcoming' | 'Completed'>('All');
  const [compSearch, setCompSearch] = useState<string>('');
  const [clubSearch, setClubSearch] = useState<string>('');
  const [clubCategoryFilter, setClubCategoryFilter] = useState<string>('All');
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<string>('All');
  const [badgeCategoryFilter, setBadgeCategoryFilter] = useState<string>('All');

  const [leaderboardCategory, setLeaderboardCategory] = useState<
    'Academic' | 'Competition' | 'Sports' | 'Attendance' | 'House' | 'Club'
  >('Academic');
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'Weekly' | 'Monthly' | 'Yearly'>('Monthly');

  // Modals
  const [showCreateCompModal, setShowCreateCompModal] = useState(false);
  const [showAwardBadgeModal, setShowAwardBadgeModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [showAddClubModal, setShowAddClubModal] = useState(false);
  const [showAddGalleryModal, setShowAddGalleryModal] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<GalleryAlbum | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);

  // Forms
  const [newCompForm, setNewCompForm] = useState({
    title: '',
    description: '',
    category: 'Coding' as CompetitionCategory,
    startDate: '',
    endDate: '',
    location: '',
    mode: 'Hybrid' as Competition['mode'],
    type: 'Individual' as Competition['type'],
    eligibility: 'All Grades',
    prizePool: '',
  });

  const [newBadgeForm, setNewBadgeForm] = useState({
    title: 'Top Performer',
    category: 'Academic',
    icon: '🏆',
    awardedToName: '',
    reason: '',
  });

  const [newEventForm, setNewEventForm] = useState({
    title: '',
    category: 'Competition' as SchoolEvent['category'],
    date: '',
    time: '',
    location: '',
    description: '',
  });

  const [newPollForm, setNewPollForm] = useState({
    question: '',
    category: 'Best House' as SchoolPoll['category'],
    optionsText: '',
  });

  const [newClubForm, setNewClubForm] = useState({
    name: '',
    category: 'Technology',
    description: '',
    icon: '💻',
    leadTeacher: '',
    studentHead: '',
    meetingDays: 'Every Wednesday (3:30 PM)',
    location: 'Activity Hall',
  });

  const [newGalleryForm, setNewGalleryForm] = useState<{
    title: string;
    category: GalleryAlbum['category'];
    coverUrl: string;
    photoCount: number;
  }>({
    title: '',
    category: 'Events',
    coverUrl: '',
    photoCount: 8,
  });

  // Persist local cache
  useEffect(() => {
    try {
      localStorage.setItem('studentos_competitions', JSON.stringify(competitions));
    } catch (_) {}
  }, [competitions]);
  useEffect(() => {
    try {
      localStorage.setItem('studentos_registered_comps', JSON.stringify(registeredCompIds));
    } catch (_) {}
  }, [registeredCompIds]);
  useEffect(() => {
    try {
      localStorage.setItem('studentos_houses', JSON.stringify(houses));
    } catch (_) {}
  }, [houses]);
  useEffect(() => {
    try {
      localStorage.setItem('studentos_clubs', JSON.stringify(clubs));
    } catch (_) {}
  }, [clubs]);
  useEffect(() => {
    try {
      localStorage.setItem('studentos_joined_clubs', JSON.stringify(joinedClubIds));
    } catch (_) {}
  }, [joinedClubIds]);
  useEffect(() => {
    try {
      localStorage.setItem('studentos_badges', JSON.stringify(badges));
    } catch (_) {}
  }, [badges]);
  useEffect(() => {
    try {
      localStorage.setItem('studentos_events', JSON.stringify(events));
    } catch (_) {}
  }, [events]);
  useEffect(() => {
    try {
      localStorage.setItem('studentos_polls', JSON.stringify(polls));
    } catch (_) {}
  }, [polls]);

  const isStaffRole = canManageLifeContent(currentUser.role);

  const containerVariants = useMemo(() => getStaggerContainerVariants(prefersReduced, 0.045), [prefersReduced]);
  const itemVariants = useMemo(() => getItemRevealVariants(prefersReduced, 10), [prefersReduced]);

  const sortedHouses = useMemo(
    () =>
      [...houses]
        .sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0))
        .map((h, i) => ({ ...h, rank: i + 1 })),
    [houses]
  );

  const maxHousePoints = useMemo(
    () => Math.max(1, ...sortedHouses.map((h) => Number(h.points) || 0)),
    [sortedHouses]
  );

  const featuredCompetition = useMemo(
    () => competitions.find((c) => c.status === 'Live') || competitions[0] || INITIAL_COMPETITIONS[0],
    [competitions]
  );

  const filteredCompetitions = useMemo(() => {
    const q = compSearch.trim().toLowerCase();
    return competitions.filter((c) => {
      if (compCategoryFilter !== 'All' && c.category !== compCategoryFilter) return false;
      if (compStatusFilter !== 'All' && c.status !== compStatusFilter) return false;
      if (q && !`${c.title} ${c.description} ${c.category} ${c.location}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [competitions, compCategoryFilter, compStatusFilter, compSearch]);

  const filteredClubs = useMemo(() => {
    const q = clubSearch.trim().toLowerCase();
    return clubs.filter((cl) => {
      if (clubCategoryFilter !== 'All' && cl.category !== clubCategoryFilter) return false;
      if (q && !`${cl.name} ${cl.description} ${cl.leadTeacher} ${cl.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clubs, clubCategoryFilter, clubSearch]);

  const filteredEvents = useMemo(
    () => events.filter((ev) => calendarCategoryFilter === 'All' || ev.category === calendarCategoryFilter),
    [events, calendarCategoryFilter]
  );

  const filteredBadges = useMemo(
    () => badges.filter((b) => badgeCategoryFilter === 'All' || b.category === badgeCategoryFilter),
    [badges, badgeCategoryFilter]
  );

  const handleRegisterCompetition = (compId: string) => {
    soundService.playClick();
    if (registeredCompIds.includes(compId)) {
      setRegisteredCompIds((prev) => prev.filter((id) => id !== compId));
      setCompetitions((prev) =>
        prev.map((c) => (c.id === compId ? { ...c, registeredCount: Math.max(0, c.registeredCount - 1) } : c))
      );
    } else {
      setRegisteredCompIds((prev) => [...prev, compId]);
      setCompetitions((prev) =>
        prev.map((c) => (c.id === compId ? { ...c, registeredCount: c.registeredCount + 1 } : c))
      );
      soundService.playSuccess();
    }
  };

  const handleToggleClub = (clubId: string) => {
    soundService.playClick();
    if (joinedClubIds.includes(clubId)) {
      setJoinedClubIds((prev) => prev.filter((id) => id !== clubId));
      setClubs((prev) =>
        prev.map((cl) => (cl.id === clubId ? { ...cl, memberCount: Math.max(0, cl.memberCount - 1) } : cl))
      );
    } else {
      setJoinedClubIds((prev) => [...prev, clubId]);
      setClubs((prev) =>
        prev.map((cl) => (cl.id === clubId ? { ...cl, memberCount: cl.memberCount + 1 } : cl))
      );
      soundService.playSuccess();
    }
  };

  const handleAwardHousePoints = async (houseId: string, delta: number) => {
    if (!isStaffRole) return;
    soundService.playSuccess();
    setHouses((prev) =>
      prev.map((h) => (h.id === houseId ? { ...h, points: Math.max(0, (Number(h.points) || 0) + delta) } : h))
    );
    await updateHousePoints(houseId, delta);
  };

  const handleVotePoll = async (pollId: string, optionId: string) => {
    const activeUid = currentUser?.uid || (currentUser as any)?.id;
    const targetPoll = polls.find((p) => p.id === pollId);
    if (targetPoll?.userVotedOptionId) return;

    soundService.playSuccess();
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p;
        const updatedOptions = p.options.map((opt) =>
          opt.id === optionId ? { ...opt, votes: (Number(opt.votes) || 0) + 1 } : opt
        );
        return {
          ...p,
          options: updatedOptions,
          totalVotes: (Number(p.totalVotes) || 0) + 1,
          userVotedOptionId: optionId,
        };
      })
    );

    try {
      await votePoll(pollId, optionId, activeUid);
    } catch (err) {
      console.warn('Notice persisting poll vote to Supabase:', err);
    }
  };

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffRole || !newCompForm.title.trim()) return;
    soundService.playSuccess();
    const created: Competition = {
      id: `comp-${Date.now()}`,
      title: newCompForm.title,
      description: newCompForm.description || 'Inter-school competitive event.',
      category: newCompForm.category,
      startDate: newCompForm.startDate || new Date().toISOString().split('T')[0],
      endDate: newCompForm.endDate || new Date().toISOString().split('T')[0],
      location: newCompForm.location || 'School Campus',
      mode: newCompForm.mode,
      type: newCompForm.type,
      eligibility: newCompForm.eligibility,
      prizePool: newCompForm.prizePool || 'Medals & Merit Certificates',
      status: 'Upcoming',
      createdBy: currentUser.name || 'Teacher Coordinator',
      registeredCount: 1,
      bannerUrl: '',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setCompetitions((prev) => [created, ...prev]);
    await createCompetition(created);
    setShowCreateCompModal(false);
    setNewCompForm({
      title: '',
      description: '',
      category: 'Coding',
      startDate: '',
      endDate: '',
      location: '',
      mode: 'Hybrid',
      type: 'Individual',
      eligibility: 'All Grades',
      prizePool: '',
    });
  };

  const handleAwardBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffRole || !newBadgeForm.awardedToName.trim()) return;
    soundService.playAchievement();
    const newB: StudentBadge = {
      id: `badge-${Date.now()}`,
      title: newBadgeForm.title,
      icon: newBadgeForm.icon,
      category: newBadgeForm.category,
      awardedToUid: `u-${Date.now()}`,
      awardedToName: newBadgeForm.awardedToName,
      awardedBy: currentUser.name || 'Teacher',
      reason: newBadgeForm.reason || 'Outstanding dedication and achievement.',
      awardedAt: new Date().toISOString().split('T')[0],
    };
    setBadges((prev) => [newB, ...prev]);
    await awardBadge(newB);
    setShowAwardBadgeModal(false);
    setNewBadgeForm({ title: 'Top Performer', category: 'Academic', icon: '🏆', awardedToName: '', reason: '' });
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffRole || !newEventForm.title.trim()) return;
    soundService.playSuccess();
    const ev: SchoolEvent = {
      id: `ev-${Date.now()}`,
      title: newEventForm.title,
      category: newEventForm.category,
      date: newEventForm.date || new Date().toISOString().split('T')[0],
      time: newEventForm.time || '10:00 AM',
      location: newEventForm.location || 'School Auditorium',
      description: newEventForm.description || 'Important school activity.',
      createdBy: currentUser.name,
    };
    setEvents((prev) => [...prev, ev]);
    await createSchoolEvent(ev);
    setShowAddEventModal(false);
    setNewEventForm({ title: '', category: 'Competition', date: '', time: '', location: '', description: '' });
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffRole || !newPollForm.question.trim()) return;
    soundService.playSuccess();
    const opts = newPollForm.optionsText
      .split(',')
      .map((t, idx) => ({
        id: `opt-${Date.now()}-${idx}`,
        text: t.trim() || `Option ${idx + 1}`,
        votes: 0,
      }))
      .filter((o) => o.text);
    const newP: SchoolPoll = {
      id: `poll-${Date.now()}`,
      question: newPollForm.question,
      category: newPollForm.category,
      options: opts.length > 0 ? opts : [{ id: 'opt-1', text: 'Yes', votes: 0 }, { id: 'opt-2', text: 'No', votes: 0 }],
      totalVotes: 0,
      createdBy: currentUser.name || 'Student Council',
      createdAt: new Date().toISOString().split('T')[0],
      isActive: true,
    };
    setPolls((prev) => [newP, ...prev]);
    await createPoll(newP);
    setShowCreatePollModal(false);
    setNewPollForm({ question: '', category: 'Best House', optionsText: '' });
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffRole || !newClubForm.name.trim()) return;
    soundService.playSuccess();
    const cl: Club = {
      id: `club-${Date.now()}`,
      name: newClubForm.name,
      category: newClubForm.category,
      description: newClubForm.description || 'Student collaborative interest club.',
      icon: newClubForm.icon || '⭐',
      leadTeacher: newClubForm.leadTeacher || currentUser.name || 'Faculty Advisor',
      studentHead: newClubForm.studentHead || 'Student Representative',
      memberCount: 1,
      meetingDays: newClubForm.meetingDays || 'Weekly',
      location: newClubForm.location || 'Activity Room',
    };
    setClubs((prev) => [...prev, cl]);
    await createClub(cl);
    setShowAddClubModal(false);
    setNewClubForm({
      name: '',
      category: 'Technology',
      description: '',
      icon: '💻',
      leadTeacher: '',
      studentHead: '',
      meetingDays: 'Every Wednesday (3:30 PM)',
      location: 'Activity Hall',
    });
  };

  const handleCreateGalleryAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffRole || !newGalleryForm.title.trim()) return;
    soundService.playSuccess();
    const alb: GalleryAlbum = {
      id: `gal-${Date.now()}`,
      title: newGalleryForm.title,
      category: newGalleryForm.category,
      coverUrl: newGalleryForm.coverUrl.trim(),
      photoCount: Number(newGalleryForm.photoCount) || 8,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setGallery((prev) => [alb, ...prev]);
    await createGalleryAlbum(alb);
    setShowAddGalleryModal(false);
    setNewGalleryForm({ title: '', category: 'Events', coverUrl: '', photoCount: 8 });
  };

  const lifeTabs: { id: LifeTabId; label: string; icon: React.FC<{ className?: string }>; count?: number }[] = [
    { id: 'dashboard', label: 'Overview', icon: Sparkles },
    {
      id: 'competitions',
      label: 'Competitions',
      icon: Trophy,
      count: competitions.filter((c) => c.status === 'Live' || c.status === 'Upcoming').length,
    },
    { id: 'leaderboards', label: 'Leaderboards', icon: Flame },
    { id: 'houses', label: 'Houses', icon: Shield },
    { id: 'clubs', label: 'Clubs', icon: Users, count: clubs.length },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'achievements', label: 'Badges', icon: Award },
    { id: 'gallery', label: 'Gallery', icon: ImageIcon },
    { id: 'news', label: 'News', icon: Newspaper },
    { id: 'polls', label: 'Polls', icon: Vote, count: polls.filter((p) => p.isActive).length },
  ];

  const timeframeMultiplier = leaderboardTimeframe === 'Weekly' ? 0.28 : leaderboardTimeframe === 'Yearly' ? 2.4 : 1;
  const displayLeaderboard = useMemo(() => {
    return [...CAMPUS_STANDINGS]
      .sort((a, b) => {
        if (a.category === leaderboardCategory && b.category !== leaderboardCategory) return -1;
        if (b.category === leaderboardCategory && a.category !== leaderboardCategory) return 1;
        return b.points - a.points;
      })
      .map((u, idx) => ({
        ...u,
        displayRank: idx + 1,
        displayPoints: Math.round(u.points * timeframeMultiplier),
      }));
  }, [leaderboardCategory, timeframeMultiplier]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border-b border-white/10 px-4 sm:px-6 pt-6 sm:pt-8 pb-0 relative overflow-hidden">
        {!prefersReduced && <BackgroundBeams className="opacity-25" />}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 22% 20%, rgba(99, 102, 241, 0.2), transparent 55%), radial-gradient(circle at 85% 40%, rgba(14, 165, 233, 0.14), transparent 55%)',
          }}
        />

        <div className="max-w-7xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                <span>Digital Campus Community</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-emerald-300">
                  {isStaffRole ? `${(currentUser.role || 'faculty').replace('_', ' ')} Mode` : 'Student Portal'}
                </span>
                {sortedHouses[0] && (
                  <>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className="text-amber-300 font-mono tabular-nums">
                      Cup Leader: {sortedHouses[0].name}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <VeylentraIcon name="clover" size={30} glow />
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-black text-white tracking-tight">
                  Veylentra <span className="bg-gradient-to-r from-amber-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">Life</span>
                </h1>
              </div>

              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                {isStaffRole
                  ? 'Coordinate inter-house competitions, supervise student societies, launch live campus polls, and recognize student excellence.'
                  : 'Explore campus competitions, live house cup standings, active clubs, achievement awards, and student polls.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              {isStaffRole && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick();
                      setShowCreateCompModal(true);
                    }}
                    className="uiverse-btn-primary px-4 py-2.5 text-white font-bold text-xs rounded-xl flex items-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Competition</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick();
                      setShowAwardBadgeModal(true);
                    }}
                    className="px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/35 text-purple-200 border border-purple-500/35 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-purple-300" />
                    <span>Award Badge</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onTriggerOrionAction?.("Show today's summary")}
                className="px-4 py-2.5 bg-slate-900/90 hover:bg-slate-800 text-indigo-200 border border-indigo-500/30 font-semibold text-xs rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Ask Orion AI</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs with Motion layoutId */}
          <div
            role="tablist"
            aria-label="Veylentra Life sections"
            className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-3 pt-1"
          >
            {lifeTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => {
                    soundService.playButtonClick();
                    setActiveTab(tab.id);
                  }}
                  className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 whitespace-nowrap transition-colors cursor-pointer select-none ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  {isActive && !prefersReduced && (
                    <motion.div
                      layoutId="veylentra-life-active-tab"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-indigo-600/90 border border-indigo-400/35 shadow-sm"
                    />
                  )}
                  {isActive && prefersReduced && (
                    <span className="absolute inset-0 rounded-xl bg-indigo-600/90 border border-indigo-400/35" />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span
                        className={`font-mono text-[10px] tabular-nums px-1.5 py-0.5 rounded-md ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-slate-400'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sync Error Alert */}
      {lifeError && (
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4">
          <div className="p-3 rounded-2xl bg-amber-950/50 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">{lifeError} Showing saved campus snapshot.</span>
            </div>
            <button
              type="button"
              onClick={() => loadAllLifeData(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 relative z-10">
        {isLoadingLife && activeTab === 'dashboard' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <AnimatedSkeleton width="50%" height={12} />
                  <AnimatedSkeleton width="70%" height={28} />
                  <AnimatedSkeleton width="100%" height={36} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <AnimatedSkeleton width="35%" height={16} />
                <AnimatedSkeleton width="80%" height={30} />
                <AnimatedSkeleton width="100%" height={72} />
              </div>
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <AnimatedSkeleton width="55%" height={16} />
                <AnimatedSkeleton width="100%" height={120} />
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* ================= TAB 1: DASHBOARD ================= */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="tab-dashboard"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.easeOutExpo }}
                className="space-y-7"
              >
                {/* Top KPI Bento Grid */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
                >
                  {/* House Cup Leaderboard Mini */}
                  <motion.div
                    variants={itemVariants}
                    className="bento-card rounded-2xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          House Championship
                        </span>
                        <Shield className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="space-y-2.5">
                        {sortedHouses.slice(0, 3).map((h, i) => {
                          const ratio = Math.min(1, Math.max(0.15, (Number(h.points) || 0) / maxHousePoints));
                          return (
                            <div key={h.id} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-200 truncate">
                                  #{i + 1} {h.name.split(' ')[1] || h.name}
                                </span>
                                <span className="font-mono font-bold tabular-nums text-amber-300">
                                  {h.points} pts
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                                <motion.div
                                  initial={prefersReduced ? { scaleX: ratio } : { scaleX: 0 }}
                                  animate={{ scaleX: ratio }}
                                  transition={{ duration: 0.6, delay: i * 0.08, ease: MOTION_EASE.easeOutExpo }}
                                  style={{ transformOrigin: 'left' }}
                                  className={`h-full rounded-full ${HOUSE_BAR_COLOR[h.id] || 'bg-indigo-500'}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('houses')}
                      className="mt-4 text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <span>View House Standings</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>

                  {/* Competitions */}
                  <motion.div
                    variants={itemVariants}
                    className="bento-card rounded-2xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Competitions
                        </span>
                        <Trophy className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <NumberTicker
                          value={competitions.filter((c) => c.status === 'Live' || c.status === 'Upcoming').length}
                          className="text-3xl font-black text-white"
                        />
                        <span className="text-xs font-semibold text-slate-400">Open Events</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Join Hackathons, Debates, Robotics, and Chess tournaments.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('competitions')}
                      className="mt-4 w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Browse Competitions
                    </button>
                  </motion.div>

                  {/* Clubs */}
                  <motion.div
                    variants={itemVariants}
                    className="bento-card rounded-2xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Student Societies
                        </span>
                        <Users className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <NumberTicker
                          value={isStaffRole ? clubs.length : joinedClubIds.length}
                          className="text-3xl font-black text-white"
                        />
                        <span className="text-xs font-semibold text-slate-400">
                          {isStaffRole ? 'Active Clubs' : 'Clubs Joined'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {isStaffRole
                          ? 'Supervise STEM, Robotics, Arts, and Debate societies.'
                          : 'Weekly Coding, Robotics, Music & Astronomy meetups.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('clubs')}
                      className="mt-4 w-full py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      {isStaffRole ? 'Supervise Clubs' : 'Explore Clubs'}
                    </button>
                  </motion.div>

                  {/* Badges */}
                  <motion.div
                    variants={itemVariants}
                    className="bento-card rounded-2xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Honor Roll
                        </span>
                        <Award className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <NumberTicker value={badges.length} className="text-3xl font-black text-white" />
                        <span className="text-xs font-semibold text-slate-400">Merit Badges</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Recognized honors for academics, attendance & leadership.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('achievements')}
                      className="mt-4 w-full py-2 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      View Honor Wall
                    </button>
                  </motion.div>
                </motion.div>

                {/* Featured Live Event + Live School Poll */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {featuredCompetition && (
                    <div className="lg:col-span-2 rounded-3xl border border-indigo-500/30 bg-slate-900 overflow-hidden shadow-2xl relative flex flex-col justify-between">
                      <div className="h-44 sm:h-48 relative">
                        <CampusCoverArtwork
                          category={featuredCompetition.category}
                          title={featuredCompetition.title}
                          imageUrl={featuredCompetition.bannerUrl}
                          className="w-full h-full"
                        />
                        <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                          <span className="px-3 py-1 bg-slate-950/85 backdrop-blur-md border border-white/15 text-amber-300 text-[11px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5 text-rose-400" />
                            <span>Featured {featuredCompetition.status} Event</span>
                          </span>
                          <span className="px-2.5 py-1 bg-slate-950/80 rounded-lg text-xs font-mono tabular-nums text-slate-200 border border-white/10">
                            {featuredCompetition.startDate}
                          </span>
                        </div>
                      </div>

                      <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h3 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight">
                            {featuredCompetition.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                            {featuredCompetition.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300 font-medium">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="truncate max-w-[200px]">{featuredCompetition.location}</span>
                            </span>
                            <span className="flex items-center gap-1.5 font-mono tabular-nums">
                              <Users className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{featuredCompetition.registeredCount} Registered</span>
                            </span>
                            {featuredCompetition.prizePool && (
                              <span className="flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                <span className="truncate max-w-[220px]">{featuredCompetition.prizePool}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedCompetition(featuredCompetition)}
                              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRegisterCompetition(featuredCompetition.id)}
                              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
                                registeredCompIds.includes(featuredCompetition.id)
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25'
                              }`}
                            >
                              {registeredCompIds.includes(featuredCompetition.id) ? (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Trophy className="w-4 h-4" />
                              )}
                              <span>
                                {registeredCompIds.includes(featuredCompetition.id)
                                  ? 'Registered'
                                  : 'Register Team'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live Poll Widget */}
                  {polls.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3 text-[11px]">
                          <span className="font-bold uppercase tracking-wider text-purple-300">
                            Live Campus Poll
                          </span>
                          <span className="font-mono tabular-nums text-slate-400">
                            {polls[0].totalVotes} votes
                          </span>
                        </div>

                        <h4 className="text-sm sm:text-base font-display font-bold text-white mb-4 leading-snug">
                          {polls[0].question}
                        </h4>

                        <div className="space-y-2.5">
                          {polls[0].options.map((opt) => {
                            const pct =
                              polls[0].totalVotes > 0 ? Math.round((opt.votes / polls[0].totalVotes) * 100) : 0;
                            const isVoted = polls[0].userVotedOptionId === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleVotePoll(polls[0].id, opt.id)}
                                className={`w-full p-3 rounded-xl border text-left transition-colors relative overflow-hidden cursor-pointer ${
                                  isVoted
                                    ? 'bg-indigo-950/60 border-indigo-500/55 text-indigo-100'
                                    : 'bg-slate-950 border-white/10 hover:border-indigo-500/35 text-slate-200'
                                }`}
                              >
                                <motion.div
                                  initial={prefersReduced ? { scaleX: pct / 100 } : { scaleX: 0 }}
                                  animate={{ scaleX: pct / 100 }}
                                  transition={{ duration: 0.45, ease: MOTION_EASE.easeOutExpo }}
                                  style={{ transformOrigin: 'left' }}
                                  className="absolute inset-0 bg-indigo-500/20 pointer-events-none"
                                />
                                <div className="flex items-center justify-between relative z-10 text-xs font-semibold gap-2">
                                  <span className="flex items-center gap-2 min-w-0">
                                    {isVoted && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                                    <span className="truncate">{opt.text}</span>
                                  </span>
                                  <span className="font-mono tabular-nums text-[11px] text-slate-300 shrink-0">
                                    {pct}%
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('polls')}
                        className="mt-5 text-center text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>View All Polls</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* News & Calendar Snapshot */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
                        <Newspaper className="w-4 h-4 text-indigo-400" />
                        <span>Campus News & Stories</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('news')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                      >
                        View All
                      </button>
                    </div>

                    <div className="space-y-3">
                      {newsList.slice(0, 3).map((item, idx) => (
                        <div
                          key={item.id}
                          onClick={() => setActiveTab('news')}
                          className="p-3.5 rounded-2xl bg-slate-950/75 border border-white/5 hover:border-indigo-500/30 transition-colors flex flex-col sm:flex-row gap-3.5 items-start cursor-pointer"
                        >
                          <div className="w-full sm:w-20 h-28 sm:h-20 rounded-xl overflow-hidden border border-white/10 shrink-0">
                            <CampusCoverArtwork
                              category={item.category}
                              title={item.title}
                              imageUrl={item.imageUrl}
                              variantSeed={idx}
                              compact
                              className="w-full h-full"
                            />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span className="font-bold text-amber-300 uppercase tracking-wider">
                                {item.category}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{item.publishedAt}</span>
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{item.title}</h4>
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <span>Upcoming School Events</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('calendar')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                      >
                        Open Calendar
                      </button>
                    </div>

                    <div className="space-y-3">
                      {events.slice(0, 4).map((ev) => {
                        const dateParts = (ev.date || '').split('-');
                        return (
                          <div
                            key={ev.id}
                            className="p-3.5 rounded-2xl bg-slate-950/75 border border-white/5 hover:border-amber-500/30 transition-colors flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/25 rounded-xl text-center shrink-0 min-w-[48px]">
                                <span className="text-[10px] font-mono text-indigo-300 uppercase block font-bold">
                                  {dateParts[1] || '--'}
                                </span>
                                <span className="text-sm font-black text-white font-mono tabular-nums">
                                  {dateParts[2] || '--'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs sm:text-sm font-bold text-white truncate">{ev.title}</h4>
                                <span className="text-[11px] text-slate-400 block truncate">
                                  {ev.time || 'All Day'} · {ev.location}
                                </span>
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold text-amber-300 shrink-0">
                              {ev.category}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ================= TAB 2: COMPETITIONS ================= */}
            {activeTab === 'competitions' && (
              <motion.div
                key="tab-competitions"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.easeOutExpo }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-3.5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={compSearch}
                        onChange={(e) => setCompSearch(e.target.value)}
                        placeholder="Search competitions by title, category, or venue..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center p-1 rounded-xl bg-slate-950 border border-white/10">
                        {(['All', 'Live', 'Upcoming', 'Completed'] as const).map((st) => {
                          const active = compStatusFilter === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setCompStatusFilter(st)}
                              className={`relative px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                active ? 'text-white' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {active && !prefersReduced && (
                                <motion.div
                                  layoutId="comp-status-pill"
                                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                  className="absolute inset-0 rounded-lg bg-indigo-600"
                                />
                              )}
                              {active && prefersReduced && (
                                <span className="absolute inset-0 rounded-lg bg-indigo-600" />
                              )}
                              <span className="relative z-10">{st}</span>
                            </button>
                          );
                        })}
                      </div>

                      {isStaffRole && (
                        <button
                          type="button"
                          onClick={() => setShowCreateCompModal(true)}
                          className="uiverse-btn-primary px-4 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Competition</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                    {['All', 'Coding', 'Robotics', 'Debate', 'Chess', 'Science Fair', 'Sports'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCompCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                          compCategoryFilter === cat
                            ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/40'
                            : 'bg-slate-950/70 text-slate-400 hover:text-white border border-white/5'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredCompetitions.length === 0 ? (
                  <div className="p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                    <Trophy className="w-9 h-9 text-slate-500 mx-auto" />
                    <h4 className="text-base font-bold text-white">No competitions match your filters</h4>
                    <p className="text-xs text-slate-400">
                      Try selecting a different category, status, or clearing the search box.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCompCategoryFilter('All');
                        setCompStatusFilter('All');
                        setCompSearch('');
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {filteredCompetitions.map((comp, idx) => {
                      const isRegistered = registeredCompIds.includes(comp.id);
                      return (
                        <motion.div
                          key={comp.id}
                          variants={itemVariants}
                          className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between group hover:border-indigo-500/40 transition-colors"
                        >
                          <div>
                            <div
                              onClick={() => setSelectedCompetition(comp)}
                              className="h-40 relative overflow-hidden cursor-pointer"
                            >
                              <CampusCoverArtwork
                                category={comp.category}
                                title={comp.title}
                                imageUrl={comp.bannerUrl}
                                variantSeed={idx}
                                className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute top-3 left-3 flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-slate-950/85 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold uppercase rounded-lg">
                                  {comp.category}
                                </span>
                                <span
                                  className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg ${
                                    comp.status === 'Live'
                                      ? 'bg-rose-500/90 text-white'
                                      : comp.status === 'Upcoming'
                                        ? 'bg-amber-400 text-slate-950'
                                        : 'bg-emerald-500/90 text-white'
                                  }`}
                                >
                                  {comp.status}
                                </span>
                              </div>
                            </div>

                            <div className="p-5 space-y-3">
                              <h3
                                onClick={() => setSelectedCompetition(comp)}
                                className="text-base font-display font-bold text-white leading-snug hover:text-indigo-300 transition-colors cursor-pointer"
                              >
                                {comp.title}
                              </h3>
                              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                                {comp.description}
                              </p>

                              <div className="space-y-1.5 pt-2.5 border-t border-white/5 text-[11px] text-slate-300 font-medium">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-slate-500">Schedule</span>
                                  <span className="font-mono tabular-nums text-slate-200">
                                    {comp.startDate} to {comp.endDate}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-slate-500">Eligibility</span>
                                  <span className="text-indigo-300">{comp.eligibility}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-slate-500">Format</span>
                                  <span>
                                    {comp.type} · {comp.mode}
                                  </span>
                                </div>
                                {comp.prizePool && (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-slate-500">Prize</span>
                                    <span className="text-amber-300 font-bold truncate max-w-[180px]">
                                      {comp.prizePool}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {comp.winners && comp.winners.length > 0 && (
                                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                                    <Trophy className="w-3 h-3" />
                                    <span>Official Winners</span>
                                  </span>
                                  {comp.winners.map((w) => (
                                    <div key={w.rank} className="flex items-center justify-between text-[11px]">
                                      <span className="text-white font-semibold">
                                        #{w.rank} {w.name} ({w.house})
                                      </span>
                                      <span className="text-amber-300 font-mono text-[10px]">{w.prize}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-5 pt-0 flex items-center gap-2">
                            {isStaffRole ? (
                              <div className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 font-bold text-xs flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5">
                                  <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                                  <span>Faculty Oversight</span>
                                </span>
                                <span className="font-mono tabular-nums text-[11px] text-white">
                                  {comp.registeredCount} Registered
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRegisterCompetition(comp.id)}
                                className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                  isRegistered
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                                    : 'uiverse-btn-primary text-white shadow-md'
                                }`}
                              >
                                {isRegistered ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Trophy className="w-4 h-4" />
                                )}
                                <span>{isRegistered ? 'Registered (Cancel)' : 'Register Team'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedCompetition(comp)}
                              className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 cursor-pointer"
                            >
                              Info
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ================= TAB 3: LEADERBOARDS ================= */}
            {activeTab === 'leaderboards' && (
              <motion.div
                key="tab-leaderboards"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.easeOutExpo }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar">
                    {(['Academic', 'Competition', 'Sports', 'Attendance', 'House', 'Club'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setLeaderboardCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                          leaderboardCategory === cat
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-white/5'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex items-center p-1 rounded-xl bg-slate-950 border border-white/10 w-full md:w-auto justify-center">
                    {(['Weekly', 'Monthly', 'Yearly'] as const).map((tf) => {
                      const active = leaderboardTimeframe === tf;
                      return (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setLeaderboardTimeframe(tf)}
                          className={`relative px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            active ? 'text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {active && !prefersReduced && (
                            <motion.div
                              layoutId="leaderboard-timeframe-pill"
                              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                              className="absolute inset-0 rounded-lg bg-indigo-600"
                            />
                          )}
                          {active && prefersReduced && (
                            <span className="absolute inset-0 rounded-lg bg-indigo-600" />
                          )}
                          <span className="relative z-10">{tf}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Top 3 Podium */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 items-end">
                  {/* #2 Silver */}
                  <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 text-center shadow-xl md:order-1 flex flex-col items-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-400/50 flex items-center justify-center text-slate-200 shadow-lg">
                      <Medal className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      #2 Silver Leader
                    </span>
                    <div>
                      <h3 className="text-lg font-display font-bold text-white">{displayLeaderboard[1].name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {displayLeaderboard[1].grade} · House {displayLeaderboard[1].house}
                      </p>
                    </div>
                    <div className="px-4 py-2 bg-slate-950 rounded-xl font-mono tabular-nums text-slate-200 font-bold text-sm border border-white/10">
                      {displayLeaderboard[1].displayPoints.toLocaleString()} pts
                    </div>
                  </div>

                  {/* #1 Gold */}
                  <div className="bg-gradient-to-b from-indigo-950/90 via-slate-900 to-slate-900 border border-amber-400/50 rounded-3xl p-6 text-center shadow-2xl md:order-2 flex flex-col items-center space-y-3 md:pb-8">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-xl">
                      <Crown className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                      #1 Gold Champion
                    </span>
                    <div>
                      <h3 className="text-xl font-display font-black text-white">{displayLeaderboard[0].name}</h3>
                      <p className="text-xs text-indigo-300 mt-0.5">
                        {displayLeaderboard[0].grade} · House {displayLeaderboard[0].house}
                      </p>
                    </div>
                    <div className="px-5 py-2.5 bg-slate-950 rounded-xl font-mono tabular-nums text-amber-300 font-black text-base border border-amber-500/35">
                      {displayLeaderboard[0].displayPoints.toLocaleString()} pts
                    </div>
                  </div>

                  {/* #3 Bronze */}
                  <div className="bg-slate-900 border border-amber-800/60 rounded-3xl p-6 text-center shadow-xl md:order-3 flex flex-col items-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-amber-900/25 border border-amber-600/45 flex items-center justify-center text-amber-400 shadow-lg">
                      <Award className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      #3 Bronze Leader
                    </span>
                    <div>
                      <h3 className="text-lg font-display font-bold text-white">{displayLeaderboard[2].name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {displayLeaderboard[2].grade} · House {displayLeaderboard[2].house}
                      </p>
                    </div>
                    <div className="px-4 py-2 bg-slate-950 rounded-xl font-mono tabular-nums text-amber-300 font-bold text-sm border border-white/10">
                      {displayLeaderboard[2].displayPoints.toLocaleString()} pts
                    </div>
                  </div>
                </div>

                {/* Standings Rows */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-2.5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Campus Standings ({leaderboardCategory} · {leaderboardTimeframe})
                    </h3>
                  </div>
                  {displayLeaderboard.slice(3).map((u) => (
                    <div
                      key={u.name}
                      className="p-3.5 rounded-2xl bg-slate-950/75 border border-white/5 hover:border-indigo-500/30 transition-colors flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center font-mono tabular-nums shrink-0">
                          #{u.displayRank}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{u.name}</h4>
                          <span className="text-[11px] text-slate-400 block">
                            {u.grade} ·{' '}
                            <span className={HOUSE_ACCENT_TEXT[u.house] || 'text-slate-300'}>
                              House {u.house}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-semibold text-indigo-300 hidden sm:inline">
                          {u.badge}
                        </span>
                        <span className="font-mono tabular-nums text-amber-300 font-bold text-sm">
                          {u.displayPoints.toLocaleString()} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ================= TAB 4: HOUSES SYSTEM ================= */}
            {activeTab === 'houses' && (
              <motion.div
                key="tab-houses"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.easeOutExpo }}
                className="space-y-6"
              >
                {/* Live House Cup Race Strip */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-display font-bold text-white">
                        Veylentra House Championship Race
                      </h3>
                      <p className="text-xs text-slate-400">
                        Comparative points across academic excellence, competitions, and sportsmanship
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-amber-300 font-bold">
                      Leading: {sortedHouses[0]?.name}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {sortedHouses.map((h, i) => {
                      const ratio = Math.min(1, Math.max(0.12, (Number(h.points) || 0) / maxHousePoints));
                      return (
                        <div key={h.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white">
                              #{i + 1} {h.name}
                            </span>
                            <span className="font-mono tabular-nums font-bold text-slate-200">
                              {h.points.toLocaleString()} pts
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-950 border border-white/5 overflow-hidden">
                            <motion.div
                              initial={prefersReduced ? { scaleX: ratio } : { scaleX: 0 }}
                              animate={{ scaleX: ratio }}
                              transition={{ duration: 0.65, delay: i * 0.08, ease: MOTION_EASE.easeOutExpo }}
                              style={{ transformOrigin: 'left' }}
                              className={`h-full rounded-full ${HOUSE_BAR_COLOR[h.id] || 'bg-indigo-500'}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4 House Cards */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
                >
                  {sortedHouses.map((h) => (
                    <motion.div
                      key={h.id}
                      variants={itemVariants}
                      className={`bg-gradient-to-b ${h.color} p-6 rounded-3xl border border-white/15 shadow-2xl text-white flex flex-col justify-between space-y-5 relative overflow-hidden`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 bg-black/35 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-wider border border-white/15">
                            Rank #{h.rank}
                          </span>
                          <Shield className="w-5 h-5 text-white/85" />
                        </div>
                        <h3 className="text-xl font-display font-black tracking-tight">{h.name}</h3>
                        <p className="text-xs text-white/85 italic">"{h.motto}"</p>
                      </div>

                      <div className="space-y-2.5 pt-4 border-t border-white/20 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-white/75">House Points</span>
                          <NumberTicker value={Number(h.points) || 0} className="text-2xl font-black text-white" />
                        </div>
                        <div className="flex items-center justify-between text-white/90">
                          <span>Captain</span>
                          <span className="font-bold">{h.captain}</span>
                        </div>
                        {h.houseTeacher && (
                          <div className="flex items-center justify-between text-white/80">
                            <span>Mentor</span>
                            <span className="font-medium truncate max-w-[130px]">{h.houseTeacher}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-white/90">
                          <span>Trophies</span>
                          <span className="font-mono font-bold tabular-nums">{h.trophies}</span>
                        </div>

                        {isStaffRole && (
                          <div className="pt-2.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAwardHousePoints(h.id, 10)}
                              className="flex-1 py-1.5 rounded-lg bg-black/30 hover:bg-black/45 border border-white/20 text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              +10 pts
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAwardHousePoints(h.id, 25)}
                              className="flex-1 py-1.5 rounded-lg bg-black/30 hover:bg-black/45 border border-white/20 text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              +25 pts
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* ================= TAB 5: CLUBS ================= */}
            {activeTab === 'clubs' && (
              <motion.div
                key="tab-clubs"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.easeOutExpo }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-display font-bold text-white">
                        Student Interest & Activity Clubs
                      </h3>
                      <p className="text-xs text-slate-400">
                        Join student-led initiatives, STEM labs, arts studios, and debate societies
                      </p>
                    </div>
                    {isStaffRole && (
                      <button
                        type="button"
                        onClick={() => setShowAddClubModal(true)}
                        className="uiverse-btn-primary px-4 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create New Club</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={clubSearch}
                        onChange={(e) => setClubSearch(e.target.value)}
                        placeholder="Search clubs or advisors..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {['All', 'Technology', 'STEM', 'Science', 'Arts', 'Humanities'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setClubCategoryFilter(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                            clubCategoryFilter === cat
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-white/5'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredClubs.length === 0 ? (
                  <div className="p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                    <Users className="w-8 h-8 text-slate-500 mx-auto" />
                    <p className="text-sm font-bold text-white">No clubs match your filter</p>
                    <button
                      type="button"
                      onClick={() => {
                        setClubCategoryFilter('All');
                        setClubSearch('');
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Show All Clubs
                    </button>
                  </div>
                ) : (
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {filteredClubs.map((club) => {
                      const isJoined = joinedClubIds.includes(club.id);
                      return (
                        <motion.div
                          key={club.id}
                          variants={itemVariants}
                          className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-emerald-500/40 transition-colors"
                        >
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-white/10 text-emerald-300 flex items-center justify-center">
                                <LifeCategoryIcon token={club.icon} category={club.category} className="w-6 h-6" />
                              </div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                                {club.category}
                              </span>
                            </div>

                            <div>
                              <h3 className="text-lg font-display font-bold text-white">{club.name}</h3>
                              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{club.description}</p>
                            </div>

                            <div className="space-y-1.5 pt-3 border-t border-white/5 text-[11px] text-slate-300">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">Faculty Advisor</span>
                                <span className="font-semibold text-slate-200">{club.leadTeacher}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">Student Head</span>
                                <span className="text-emerald-300 font-semibold">{club.studentHead}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">Schedule</span>
                                <span className="truncate max-w-[180px]">{club.meetingDays}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">Members</span>
                                <span className="font-mono font-bold tabular-nums text-indigo-300">
                                  {club.memberCount} Students
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-5">
                            {isStaffRole ? (
                              <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 font-bold text-xs flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5">
                                  <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <span>Advisor Roster</span>
                                </span>
                                <span className="font-mono tabular-nums text-[11px] text-white">
                                  {club.memberCount} Members
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleClub(club.id)}
                                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                  isJoined
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                                    : 'uiverse-btn-primary text-white shadow-md'
                                }`}
                              >
                                {isJoined ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <UserPlus className="w-4 h-4" />
                                )}
                                <span>{isJoined ? 'Joined Club' : 'Join Club'}</span>
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ================= TAB 6: SCHOOL CALENDAR ================= */}
            {activeTab === 'calendar' && (
              <motion.div
                key="tab-calendar"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.easeOutExpo }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-display font-bold text-white">Official School Calendar</h3>
                      <p className="text-xs text-slate-400">
                        Examinations, holidays, inter-house tournaments, and parent meetings
                      </p>
                    </div>
                    {isStaffRole && (
                      <button
                        type="button"
                        onClick={() => setShowAddEventModal(true)}
                        className="uiverse-btn-primary px-4 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Event</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {['All', 'Annual Day', 'Exam', 'Parent Meeting', 'Sports Day', 'Competition', 'Holiday'].map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCalendarCategoryFilter(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                            calendarCategoryFilter === cat
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-white/5'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {filteredEvents.map((ev) => (
                    <motion.div
                      key={ev.id}
                      variants={itemVariants}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-amber-500/40 transition-colors flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold uppercase tracking-wider text-amber-300">{ev.category}</span>
                          <span className="font-mono tabular-nums text-slate-400">{ev.date}</span>
                        </div>
                        <div>
                          <h4 className="text-base font-display font-bold text-white mb-1.5">{ev.title}</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">{ev.description}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{ev.time || 'All Day'}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{ev.location}</span>
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* ================= TAB 7: ACHIEVEMENTS & BADGES ================= */}
            {activeTab === 'achievements' && (
              <motion.div
                key="tab-achievements"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.easeOutExpo }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-display font-bold text-white">Student Achievement Wall</h3>
                      <p className="text-xs text-slate-400">
                        Merit badges & honors awarded by faculty and school leadership
                      </p>
                    </div>
                    {isStaffRole && (
                      <button
                        type="button"
                        onClick={() => setShowAwardBadgeModal(true)}
                        className="uiverse-btn-primary px-4 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Award className="w-4 h-4" />
                        <span>Award Badge</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {['All', 'Academic', 'Discipline', 'Sports', 'Technology', 'Library'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setBadgeCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                          badgeCategoryFilter === cat
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/35'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-white/5'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {filteredBadges.map((b) => (
                    <motion.div
                      key={b.id}
                      variants={itemVariants}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-purple-500/40 transition-colors flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-13 h-13 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-amber-300 flex items-center justify-center shrink-0">
                            <LifeCategoryIcon token={b.icon} category={b.category} className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                              {b.category}
                            </span>
                            <h4 className="text-base font-display font-bold text-white truncate">{b.title}</h4>
                            <p className="text-xs text-indigo-300 font-semibold truncate">
                              Awarded to {b.awardedToName}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/75 p-3.5 rounded-xl border border-white/5">
                          "{b.reason}"
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-2 border-t border-white/5">
                        <span>By {b.awardedBy}</span>
                        <span className="font-mono tabular-nums">{b.awardedAt}</span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* ================= TAB 8: GALLERY ================= */}
            {activeTab === 'gallery' && (
              <motion.div
                key="tab-gallery"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.easeOutExpo }}
                className="space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
                  <div>
                    <h3 className="text-base font-display font-bold text-white">Campus Moments & Photo Gallery</h3>
                    <p className="text-xs text-slate-400">
                      Captured memories from festivals, athletics meets, science expos, and student trips
                    </p>
                  </div>
                  {isStaffRole && (
                    <button
                      type="button"
                      onClick={() => setShowAddGalleryModal(true)}
                      className="uiverse-btn-primary px-4 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Photo Album</span>
                    </button>
                  )}
                </div>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {gallery.map((album, idx) => (
                    <motion.div
                      key={album.id}
                      variants={itemVariants}
                      onClick={() => setSelectedAlbum(album)}
                      className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl group cursor-pointer hover:border-indigo-500/45 transition-colors"
                    >
                      <div className="h-48 relative overflow-hidden">
                        <CampusCoverArtwork
                          category={album.category}
                          title={album.title}
                          imageUrl={album.coverUrl}
                          variantSeed={idx}
                          className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                        />
                        <span className="absolute top-3 left-3 px-2.5 py-1 bg-slate-950/85 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded-lg border border-white/10">
                          {album.category}
                        </span>
                        <span className="absolute bottom-3 right-3 px-2.5 py-1 bg-slate-950/80 text-amber-300 text-xs font-mono tabular-nums font-bold rounded-lg border border-white/10">
                          {album.photoCount} Photos
                        </span>
                      </div>

                      <div className="p-5">
                        <h4 className="text-base font-display font-bold text-white group-hover:text-indigo-300 transition-colors">
                          {album.title}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-mono tabular-nums block mt-1">
                          Uploaded {album.createdAt}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* ================= TAB 9: NEWS & STORIES ================= */}
            {activeTab === 'news' && (
              <motion.div
                key="tab-news"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.easeOutExpo }}
                className="space-y-6 max-w-4xl mx-auto"
              >
                {newsList.map((item, idx) => (
                  <article
                    key={item.id}
                    className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl"
                  >
                    <div className="h-52 sm:h-60 relative">
                      <CampusCoverArtwork
                        category={item.category}
                        title={item.title}
                        imageUrl={item.imageUrl}
                        variantSeed={idx}
                        className="w-full h-full"
                      />
                      <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between gap-2 text-xs">
                        <span className="px-2.5 py-1 bg-slate-950/85 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase rounded-lg">
                          {item.category}
                        </span>
                        <span className="font-mono tabular-nums text-slate-200 bg-slate-950/80 px-2.5 py-1 rounded-lg">
                          {item.publishedAt}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-3">
                      <h3 className="text-lg sm:text-xl font-display font-black text-white">{item.title}</h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{item.content}</p>
                      <div className="text-xs text-slate-400 pt-3 border-t border-white/5">
                        Published by <span className="text-slate-200 font-semibold">{item.author}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </motion.div>
            )}

            {/* ================= TAB 10: POLLS & VOTING ================= */}
            {activeTab === 'polls' && (
              <motion.div
                key="tab-polls"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.easeOutExpo }}
                className="space-y-6 max-w-3xl mx-auto"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
                  <div>
                    <h3 className="text-base font-display font-bold text-white">School Voting & Live Polls</h3>
                    <p className="text-xs text-slate-400">
                      Cast your vote on campus initiatives, house honors, and annual events
                    </p>
                  </div>
                  {isStaffRole && (
                    <button
                      type="button"
                      onClick={() => setShowCreatePollModal(true)}
                      className="uiverse-btn-primary px-4 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Poll</span>
                    </button>
                  )}
                </div>

                <div className="space-y-5">
                  {polls.map((poll) => (
                    <div
                      key={poll.id}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase tracking-wider text-purple-300">{poll.category}</span>
                        <span className="text-slate-400 font-mono tabular-nums">
                          {poll.totalVotes} Total Votes
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-display font-bold text-white">{poll.question}</h3>

                      <div className="space-y-2.5">
                        {poll.options.map((opt) => {
                          const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                          const isVoted = poll.userVotedOptionId === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleVotePoll(poll.id, opt.id)}
                              className={`w-full p-4 rounded-2xl border text-left transition-colors relative overflow-hidden cursor-pointer ${
                                isVoted
                                  ? 'bg-indigo-950/75 border-indigo-500/60 text-indigo-100'
                                  : 'bg-slate-950 border-white/10 hover:border-indigo-500/35 text-slate-200'
                              }`}
                            >
                              <motion.div
                                initial={prefersReduced ? { scaleX: pct / 100 } : { scaleX: 0 }}
                                animate={{ scaleX: pct / 100 }}
                                transition={{ duration: 0.45, ease: MOTION_EASE.easeOutExpo }}
                                style={{ transformOrigin: 'left' }}
                                className="absolute inset-0 bg-indigo-500/20 pointer-events-none"
                              />
                              <div className="flex items-center justify-between relative z-10 text-xs font-bold gap-3">
                                <span className="flex items-center gap-2">
                                  {isVoted && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                                  <span>{opt.text}</span>
                                </span>
                                <span className="font-mono tabular-nums text-slate-300 shrink-0">
                                  {pct}% ({opt.votes})
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ================= MODALS (AnimatedDialog) ================= */}

      {/* Competition Detail Modal */}
      <AnimatedDialog
        isOpen={Boolean(selectedCompetition)}
        onClose={() => setSelectedCompetition(null)}
        title={selectedCompetition?.title}
        subtitle={
          selectedCompetition
            ? `${selectedCompetition.category} · ${selectedCompetition.status} · ${selectedCompetition.mode}`
            : undefined
        }
        maxWidth="max-w-xl"
      >
        {selectedCompetition && (
          <div className="space-y-4 text-xs">
            <div className="h-40 rounded-2xl overflow-hidden border border-white/10">
              <CampusCoverArtwork
                category={selectedCompetition.category}
                title={selectedCompetition.title}
                imageUrl={selectedCompetition.bannerUrl}
                className="w-full h-full"
              />
            </div>

            <p className="text-slate-300 leading-relaxed text-sm">{selectedCompetition.description}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/75 border border-white/10">
              <div>
                <span className="text-slate-500 block">Venue</span>
                <span className="text-white font-semibold">{selectedCompetition.location}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Eligibility</span>
                <span className="text-indigo-300 font-semibold">{selectedCompetition.eligibility}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Dates</span>
                <span className="font-mono tabular-nums text-white">
                  {selectedCompetition.startDate} to {selectedCompetition.endDate}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Prize Pool</span>
                <span className="text-amber-300 font-bold">{selectedCompetition.prizePool || 'Merit Certificates'}</span>
              </div>
            </div>

            {selectedCompetition.rules && selectedCompetition.rules.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Competition Rules
                </h4>
                <ul className="space-y-1 text-slate-300 list-disc pl-5">
                  {selectedCompetition.rules.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedCompetition.schedule && selectedCompetition.schedule.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Schedule</h4>
                <div className="space-y-1.5">
                  {selectedCompetition.schedule.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-white/5"
                    >
                      <span className="font-mono tabular-nums text-indigo-300 font-bold">{s.time}</span>
                      <span className="text-slate-200">{s.event}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedCompetition(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
              >
                Close
              </button>
              {!isStaffRole && (
                <button
                  type="button"
                  onClick={() => handleRegisterCompetition(selectedCompetition.id)}
                  className={`px-4 py-2 rounded-xl font-bold cursor-pointer flex items-center gap-1.5 ${
                    registeredCompIds.includes(selectedCompetition.id)
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {registeredCompIds.includes(selectedCompetition.id) ? 'Registered (Cancel)' : 'Register Team'}
                </button>
              )}
            </div>
          </div>
        )}
      </AnimatedDialog>

      {/* 1. Create Competition Modal */}
      <AnimatedDialog
        isOpen={showCreateCompModal}
        onClose={() => setShowCreateCompModal(false)}
        title="Launch New Competition"
        subtitle="Publish an academic, STEM, sports, or cultural tournament"
      >
        <form onSubmit={handleCreateCompetition} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Competition Title</label>
            <input
              type="text"
              required
              value={newCompForm.title}
              onChange={(e) => setNewCompForm({ ...newCompForm, title: e.target.value })}
              placeholder="e.g. Inter-House Code Sprint"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Category</label>
              <select
                value={newCompForm.category}
                onChange={(e) => setNewCompForm({ ...newCompForm, category: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              >
                {['Coding', 'Robotics', 'Debate', 'Chess', 'Science Fair', 'Sports', 'Olympiad'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Mode</label>
              <select
                value={newCompForm.mode}
                onChange={(e) => setNewCompForm({ ...newCompForm, mode: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              >
                <option value="Hybrid">Hybrid</option>
                <option value="Offline">Offline</option>
                <option value="Online">Online</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Start Date</label>
              <input
                type="date"
                value={newCompForm.startDate}
                onChange={(e) => setNewCompForm({ ...newCompForm, startDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Venue / Location</label>
              <input
                type="text"
                value={newCompForm.location}
                onChange={(e) => setNewCompForm({ ...newCompForm, location: e.target.value })}
                placeholder="Auditorium / Virtual"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Description</label>
            <textarea
              rows={3}
              value={newCompForm.description}
              onChange={(e) => setNewCompForm({ ...newCompForm, description: e.target.value })}
              placeholder="Details about rules, format, eligibility..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowCreateCompModal(false)}
              className="px-4 py-2 text-slate-400 hover:text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              Create Competition
            </button>
          </div>
        </form>
      </AnimatedDialog>

      {/* 2. Award Badge Modal */}
      <AnimatedDialog
        isOpen={showAwardBadgeModal}
        onClose={() => setShowAwardBadgeModal(false)}
        title="Award Student Badge"
        subtitle="Recognize student leadership, excellence, or discipline on the Honor Wall"
      >
        <form onSubmit={handleAwardBadge} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Student Full Name</label>
            <input
              type="text"
              required
              value={newBadgeForm.awardedToName}
              onChange={(e) => setNewBadgeForm({ ...newBadgeForm, awardedToName: e.target.value })}
              placeholder="e.g. Aarav Sharma"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Badge Title</label>
              <select
                value={newBadgeForm.title}
                onChange={(e) => {
                  const val = e.target.value;
                  let icon = '🏆';
                  if (val.includes('Attendance')) icon = '⭐';
                  if (val.includes('Winner')) icon = '🥇';
                  if (val.includes('Coding')) icon = '💻';
                  if (val.includes('Book')) icon = '📚';
                  if (val.includes('Artist')) icon = '🎨';
                  if (val.includes('Athlete')) icon = '🏃';
                  setNewBadgeForm({ ...newBadgeForm, title: val, icon });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              >
                <option value="Top Performer">Top Performer</option>
                <option value="Perfect Attendance">Perfect Attendance</option>
                <option value="Competition Winner">Competition Winner</option>
                <option value="Coding Champion">Coding Champion</option>
                <option value="Book Lover">Book Lover</option>
                <option value="Artist">Artist</option>
                <option value="Athlete">Athlete</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Category</label>
              <input
                type="text"
                value={newBadgeForm.category}
                onChange={(e) => setNewBadgeForm({ ...newBadgeForm, category: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Reason / Citation</label>
            <textarea
              rows={3}
              value={newBadgeForm.reason}
              onChange={(e) => setNewBadgeForm({ ...newBadgeForm, reason: e.target.value })}
              placeholder="e.g. For scoring 100% in math midterms and assisting peers."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowAwardBadgeModal(false)}
              className="px-4 py-2 text-slate-400 hover:text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              Award Badge
            </button>
          </div>
        </form>
      </AnimatedDialog>

      {/* 3. Add Event Modal */}
      <AnimatedDialog
        isOpen={showAddEventModal}
        onClose={() => setShowAddEventModal(false)}
        title="Add Calendar Event"
        subtitle="Schedule an official campus event, exam date, or holiday"
      >
        <form onSubmit={handleAddEvent} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Event Title</label>
            <input
              type="text"
              required
              value={newEventForm.title}
              onChange={(e) => setNewEventForm({ ...newEventForm, title: e.target.value })}
              placeholder="e.g. Annual Sports Day Practice"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Date</label>
              <input
                type="date"
                required
                value={newEventForm.date}
                onChange={(e) => setNewEventForm({ ...newEventForm, date: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Category</label>
              <select
                value={newEventForm.category}
                onChange={(e) => setNewEventForm({ ...newEventForm, category: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              >
                {['Holiday', 'Exam', 'Competition', 'Parent Meeting', 'Sports Day', 'Annual Day', 'Cultural'].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowAddEventModal(false)}
              className="px-4 py-2 text-slate-400 hover:text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              Add Event
            </button>
          </div>
        </form>
      </AnimatedDialog>

      {/* 4. Create Poll Modal */}
      <AnimatedDialog
        isOpen={showCreatePollModal}
        onClose={() => setShowCreatePollModal(false)}
        title="Create School Poll"
        subtitle="Gather real-time campus votes across students and faculty"
      >
        <form onSubmit={handleCreatePoll} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Poll Question</label>
            <input
              type="text"
              required
              value={newPollForm.question}
              onChange={(e) => setNewPollForm({ ...newPollForm, question: e.target.value })}
              placeholder="e.g. Which topic should be covered in the next workshop?"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Options (Comma Separated)</label>
            <input
              type="text"
              required
              value={newPollForm.optionsText}
              onChange={(e) => setNewPollForm({ ...newPollForm, optionsText: e.target.value })}
              placeholder="Option 1, Option 2, Option 3"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowCreatePollModal(false)}
              className="px-4 py-2 text-slate-400 hover:text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              Publish Poll
            </button>
          </div>
        </form>
      </AnimatedDialog>

      {/* 5. Create Club Modal */}
      <AnimatedDialog
        isOpen={showAddClubModal}
        onClose={() => setShowAddClubModal(false)}
        title="Create Student Club"
        subtitle="Register a new student society with faculty oversight"
      >
        <form onSubmit={handleCreateClub} className="space-y-3 text-xs max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Club Name</label>
            <input
              type="text"
              required
              value={newClubForm.name}
              onChange={(e) => setNewClubForm({ ...newClubForm, name: e.target.value })}
              placeholder="e.g. AI & Machine Learning Society"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Category</label>
              <select
                value={newClubForm.category}
                onChange={(e) => setNewClubForm({ ...newClubForm, category: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              >
                {['Technology', 'STEM', 'Science', 'Arts', 'Humanities', 'Sports', 'Leadership', 'General'].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Meeting Schedule</label>
              <input
                type="text"
                value={newClubForm.meetingDays}
                onChange={(e) => setNewClubForm({ ...newClubForm, meetingDays: e.target.value })}
                placeholder="Every Wednesday (3:30 PM)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Description & Mission</label>
            <textarea
              rows={2}
              value={newClubForm.description}
              onChange={(e) => setNewClubForm({ ...newClubForm, description: e.target.value })}
              placeholder="What does the club do? (Activities, workshops, competitions)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Lead Faculty Advisor</label>
              <input
                type="text"
                value={newClubForm.leadTeacher}
                onChange={(e) => setNewClubForm({ ...newClubForm, leadTeacher: e.target.value })}
                placeholder="e.g. Mr. Rajesh Verma"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Student Head</label>
              <input
                type="text"
                value={newClubForm.studentHead}
                onChange={(e) => setNewClubForm({ ...newClubForm, studentHead: e.target.value })}
                placeholder="e.g. Aarav Sharma"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowAddClubModal(false)}
              className="px-4 py-2 text-slate-400 hover:text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              Create Club
            </button>
          </div>
        </form>
      </AnimatedDialog>

      {/* 6. Add Gallery Album Modal */}
      <AnimatedDialog
        isOpen={showAddGalleryModal}
        onClose={() => setShowAddGalleryModal(false)}
        title="Add Photo Album"
        subtitle="Publish a curated campus album (custom cover URL optional)"
      >
        <form onSubmit={handleCreateGalleryAlbum} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Album Title</label>
            <input
              type="text"
              required
              value={newGalleryForm.title}
              onChange={(e) => setNewGalleryForm({ ...newGalleryForm, title: e.target.value })}
              placeholder="e.g. Science Exhibition & Robotics Finals 2026"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Category</label>
              <select
                value={newGalleryForm.category}
                onChange={(e) => setNewGalleryForm({ ...newGalleryForm, category: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              >
                {['Annual Day', 'Sports', 'Trips', 'Competitions', 'Events', 'Celebrations'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Photo Count</label>
              <input
                type="number"
                min={1}
                max={100}
                value={newGalleryForm.photoCount}
                onChange={(e) => setNewGalleryForm({ ...newGalleryForm, photoCount: Number(e.target.value) || 8 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Custom Cover Image URL (Optional)</label>
            <input
              type="url"
              value={newGalleryForm.coverUrl}
              onChange={(e) => setNewGalleryForm({ ...newGalleryForm, coverUrl: e.target.value })}
              placeholder="Leave blank to use bespoke campus category artwork"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowAddGalleryModal(false)}
              className="px-4 py-2 text-slate-400 hover:text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              Add Album
            </button>
          </div>
        </form>
      </AnimatedDialog>

      {/* 7. Album Lightbox Modal */}
      <AnimatedDialog
        isOpen={Boolean(selectedAlbum)}
        onClose={() => setSelectedAlbum(null)}
        title={selectedAlbum?.title}
        subtitle={
          selectedAlbum
            ? `${selectedAlbum.category} · Uploaded ${selectedAlbum.createdAt} · ${selectedAlbum.photoCount} Photos`
            : undefined
        }
        maxWidth="max-w-2xl"
      >
        {selectedAlbum && (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-white/10 h-60">
              <CampusCoverArtwork
                category={selectedAlbum.category}
                title={selectedAlbum.title}
                imageUrl={selectedAlbum.coverUrl}
                className="w-full h-full"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  className="h-24 rounded-xl overflow-hidden bg-slate-950 border border-white/10 relative"
                >
                  <GalleryPlaceholderTile
                    category={selectedAlbum.category}
                    index={idx}
                    title={`${selectedAlbum.title} Frame ${idx}`}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedAlbum(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Gallery</span>
              </button>
            </div>
          </div>
        )}
      </AnimatedDialog>
    </div>
  );
};

export default StudentOSLife;
