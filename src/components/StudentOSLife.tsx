import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Calendar, Users, Award, Image as ImageIcon, Flame, Newspaper, 
  Vote, Plus, Search, ChevronRight, CheckCircle, Star, Sparkles, Filter, 
  Clock, MapPin, Share2, Check, UserPlus, Send, AlertCircle, Heart, 
  MessageSquare, ExternalLink, Download, Shield, Eye, ThumbsUp, Radio
} from 'lucide-react';
import { 
  UserProfile, Competition, CompetitionCategory, HouseType, 
  Club, StudentBadge, SchoolEvent, GalleryAlbum, SchoolNews, 
  SchoolPoll, HouseDetail
} from '../types';
import {
  fetchCompetitions, createCompetition,
  fetchSchoolEvents, createSchoolEvent,
  fetchClubs, createClub,
  fetchBadges, awardBadge,
  fetchGallery, createGalleryAlbum,
  fetchHouses, updateHousePoints,
  fetchPolls, createPoll,
  fetchNews, subscribeToLifeTable
} from '../lib/supabaseLife';

interface StudentOSLifeProps {
  currentUser: UserProfile;
  onNavigateToTab?: (tab: string) => void;
  onTriggerOrionAction?: (command: string) => void;
}

// Initial Mock Data
const INITIAL_HOUSES: HouseDetail[] = [
  { id: 'Ruby', name: 'Red Ruby Lions', color: 'from-red-600 to-rose-900', points: 1450, rank: 1, captain: 'Aarav Sharma', viceCaptain: 'Ananya Gupta', motto: 'Courage, Honor & Victory', houseTeacher: 'Mr. Rajesh Verma', trophies: 12, bannerUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80' },
  { id: 'Emerald', name: 'Green Emerald Falcons', color: 'from-emerald-600 to-teal-900', points: 1380, rank: 2, captain: 'Rohan Mehta', viceCaptain: 'Siddharth Rao', motto: 'Wisdom, Growth & Excellence', houseTeacher: 'Dr. Sunita Patel', trophies: 9, bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80' },
  { id: 'Sapphire', name: 'Blue Sapphire Dragons', color: 'from-blue-600 to-indigo-900', points: 1310, rank: 3, captain: 'Priya Nair', viceCaptain: 'Kavya Singh', motto: 'Strength, Loyalty & Truth', houseTeacher: 'Mrs. Deepa Roy', trophies: 8, bannerUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80' },
  { id: 'Topaz', name: 'Yellow Topaz Phoenix', color: 'from-amber-500 to-yellow-800', points: 1240, rank: 4, captain: 'Vikram Joshi', viceCaptain: 'Diya Kapoor', motto: 'Radiance, Passion & Unity', houseTeacher: 'Mr. Amit Saxena', trophies: 7, bannerUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80' }
];

const INITIAL_COMPETITIONS: Competition[] = [
  {
    id: 'comp-1',
    title: 'Inter-House Annual Hackathon 2026',
    description: 'A 24-hour collaborative coding showcase to build innovative educational tools for students and teachers.',
    category: 'Coding',
    startDate: '2026-08-15',
    endDate: '2026-08-16',
    location: 'Main Computer Lab / StudentOS Virtual Space',
    mode: 'Hybrid',
    type: 'Team',
    maxTeamSize: 4,
    eligibility: 'Grades 8 - 12',
    prizePool: '₹25,000 + Tech Trophies & Merit Certificates',
    status: 'Live',
    createdBy: 'Computer Science Department',
    registeredCount: 42,
    bannerUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80',
    rules: ['Teams of 2-4 students', 'Open source tools permitted', 'Original code only', 'Final pitch in 5 mins'],
    schedule: [{ time: '10:00 AM', event: 'Keynote & Kickoff' }, { time: '02:00 PM', event: 'Midway Mentor Checkin' }, { time: '06:00 PM', event: 'Final Project Submission' }],
    createdAt: '2026-08-01'
  },
  {
    id: 'comp-2',
    title: 'National Science & Robotics Exhibition',
    description: 'Showcase working hardware models, IoT sensors, robotics automatons, and renewable energy prototypes.',
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
    bannerUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80',
    rules: ['Working physical model required', 'Safety regulations strictly enforced', 'Poster presentation required'],
    createdAt: '2026-08-02'
  },
  {
    id: 'comp-3',
    title: 'Grand Parliamentary Debate Championship',
    description: 'Debate on contemporary global affairs, AI ethics, climate policy, and space exploration.',
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
    bannerUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&auto=format&fit=crop&q=80',
    createdAt: '2026-08-03'
  },
  {
    id: 'comp-4',
    title: 'Inter-School Speed Chess Olympiad',
    description: 'Rapid 10-minute Swiss league chess tournament testing strategy, foresight, and tactics.',
    category: 'Chess',
    startDate: '2026-08-05',
    endDate: '2026-08-05',
    location: 'Chess Room / Online Board',
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
      { rank: 3, name: 'Kavya Singh', house: 'Sapphire', grade: 'Grade 12', prize: 'Bronze Medal' }
    ],
    bannerUrl: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&auto=format&fit=crop&q=80',
    createdAt: '2026-07-28'
  }
];

const INITIAL_CLUBS: Club[] = [
  { id: 'club-1', name: 'Coding & AI Club', category: 'Technology', description: 'Explore Web Development, Python, Machine Learning, and Competitive Programming.', icon: '💻', leadTeacher: 'Mr. Rajesh Verma', studentHead: 'Aarav Sharma', memberCount: 142, meetingDays: 'Every Tuesday & Thursday (3:30 PM)', location: 'Computer Lab 2' },
  { id: 'club-2', name: 'Robotics & Automation Club', category: 'STEM', description: 'Design Arduino, Raspberry Pi circuits, drones, and autonomous rover models.', icon: '🤖', leadTeacher: 'Dr. Sunita Patel', studentHead: 'Rohan Mehta', memberCount: 98, meetingDays: 'Every Wednesday (3:30 PM)', location: 'Robotics Tinkering Lab' },
  { id: 'club-3', name: 'Science & Astronomy Club', category: 'Science', description: 'Stargazing sessions, physics experiments, biology research, and rocket chemistry.', icon: '🧪', leadTeacher: 'Mr. Amit Saxena', studentHead: 'Ananya Gupta', memberCount: 115, meetingDays: 'Every Monday (3:30 PM)', location: 'Physics Lab' },
  { id: 'club-4', name: 'Symphony Music & Band Club', category: 'Arts', description: 'Instrumental training, vocal harmonies, school band rehearsals, and live concerts.', icon: '🎵', leadTeacher: 'Mrs. Deepa Roy', studentHead: 'Kavya Singh', memberCount: 86, meetingDays: 'Every Friday (3:30 PM)', location: 'Music Room' },
  { id: 'club-5', name: 'Fine Arts & Canvas Studio', category: 'Arts', description: 'Oil painting, digital art, sculpting, charcoal sketching, and mural projects.', icon: '🎨', leadTeacher: 'Ms. Neha Verma', studentHead: 'Diya Kapoor', memberCount: 74, meetingDays: 'Every Thursday (3:30 PM)', location: 'Art Studio' },
  { id: 'club-6', name: 'Literary & Debate Forum', category: 'Humanities', description: 'Public speaking, model UN, creative writing, poetry slams, and elocution.', icon: '📚', leadTeacher: 'Mrs. Suman Rao', studentHead: 'Priya Nair', memberCount: 104, meetingDays: 'Every Wednesday (3:30 PM)', location: 'Library Conference Room' }
];

const INITIAL_BADGES: StudentBadge[] = [
  { id: 'b-1', title: 'Top Performer', icon: '🏆', category: 'Academic', awardedToUid: 'u-1', awardedToName: 'Aarav Sharma', awardedBy: 'Principal Dr. V. K. Sharma', reason: 'Highest score in Term 1 Midterms and active peer tutoring.', awardedAt: '2026-08-01' },
  { id: 'b-2', title: 'Perfect Attendance', icon: '⭐', category: 'Discipline', awardedToUid: 'u-2', awardedToName: 'Rohan Mehta', awardedBy: 'Class Teacher Mr. Verma', reason: '100% attendance recorded for 3 consecutive months.', awardedAt: '2026-08-02' },
  { id: 'b-3', title: 'Competition Winner', icon: '🥇', category: 'Sports', awardedToUid: 'u-3', awardedToName: 'Kavya Singh', awardedBy: 'Sports Director Mr. Rawat', reason: '1st rank in Inter-School Chess Olympiad.', awardedAt: '2026-08-05' },
  { id: 'b-4', title: 'Coding Champion', icon: '💻', category: 'Technology', awardedToUid: 'u-4', awardedToName: 'Ananya Gupta', awardedBy: 'Coding Club Mentor', reason: 'Completed 50+ algorithm challenges on StudentOS Codepad.', awardedAt: '2026-08-04' },
  { id: 'b-5', title: 'Book Lover', icon: '📚', category: 'Library', awardedToUid: 'u-5', awardedToName: 'Priya Nair', awardedBy: 'Librarian Mrs. Kapoor', reason: 'Read and reviewed 15 classic literature books this session.', awardedAt: '2026-07-29' }
];

const INITIAL_EVENTS: SchoolEvent[] = [
  { id: 'ev-1', title: 'Independence Day Cultural Celebration & Flag Hoisting', category: 'Annual Day', date: '2026-08-15', time: '08:00 AM', location: 'Main School Ground', description: 'Flag hoisting ceremony, patriotic songs, drill display, and award distribution.' },
  { id: 'ev-2', title: 'Mid-Term Examination Series 2026', category: 'Exam', date: '2026-09-01', time: '09:00 AM', location: 'All Classrooms', description: 'Comprehensive mid-term exams across all grades 6 to 12.' },
  { id: 'ev-3', title: 'Parent-Teacher Meeting (PTM - Term 1)', category: 'Parent Meeting', date: '2026-08-30', time: '09:30 AM', location: 'Respective Classrooms', description: 'Discussion on academic progress, attendance, and holistic development.' },
  { id: 'ev-4', title: 'Inter-House Sports Festival 2026', category: 'Sports Day', date: '2026-08-25', time: '08:30 AM', location: 'Sports Complex', description: 'Track events, football, basketball, badminton, and house cheer competitions.' }
];

const INITIAL_GALLERY: GalleryAlbum[] = [
  { id: 'gal-1', title: 'Annual Cultural Fest & Musical Night', category: 'Annual Day', coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80', photoCount: 24, createdAt: '2026-07-20' },
  { id: 'gal-2', title: 'Inter-School Athletics Championship', category: 'Sports', coverUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80', photoCount: 18, createdAt: '2026-07-15' },
  { id: 'gal-3', title: 'Educational Science Trip to NASA Space Center', category: 'Trips', coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80', photoCount: 32, createdAt: '2026-06-10' },
  { id: 'gal-4', title: 'Robotics Expo & AI Innovation Fair', category: 'Competitions', coverUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80', photoCount: 15, createdAt: '2026-07-02' }
];

const INITIAL_NEWS: SchoolNews[] = [
  { id: 'news-1', title: 'StudentOS Innovation Hub Wins National EdTech Excellence Award', category: 'Success Story', content: 'Our school has been recognized as the top smart digital campus in the region for integrating AI-assisted learning, collaborative whiteboards, and real-time student analytics.', author: 'Principal Office', imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80', publishedAt: '2026-08-04', featured: true },
  { id: 'news-2', title: 'Robotics Team Qualifies for International Championship in Tokyo', category: 'Achievement', content: 'The school Robotics Club team "Astra Drones" scored 1st place in the zonal finals and will represent India in the International Robotics Summit.', author: 'Robotics Club Mentors', imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80', publishedAt: '2026-08-02', featured: false }
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
      { id: 'opt-4', text: 'Yellow Topaz Phoenix', votes: 80 }
    ],
    totalVotes: 435,
    createdBy: 'Student Council President',
    createdAt: '2026-08-03',
    isActive: true
  },
  {
    id: 'poll-2',
    question: 'Preferred theme for Annual Day Function 2026?',
    category: 'Event Feedback',
    options: [
      { id: 'opt-21', text: 'Future Horizons & Space AI', votes: 210 },
      { id: 'opt-22', text: 'Cultural Tapestry of India', votes: 135 },
      { id: 'opt-23', text: 'Eco-Sustain & Planet Protection', votes: 98 }
    ],
    totalVotes: 443,
    createdBy: 'Cultural Coordinator',
    createdAt: '2026-08-01',
    isActive: true
  }
];

export const StudentOSLife: React.FC<StudentOSLifeProps> = ({
  currentUser,
  onNavigateToTab,
  onTriggerOrionAction
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'competitions' | 'leaderboards' | 'houses' | 'clubs' | 'calendar' | 'achievements' | 'gallery' | 'news' | 'polls'>('dashboard');

  // State Management
  const [competitions, setCompetitions] = useState<Competition[]>(() => {
    const saved = localStorage.getItem('studentos_competitions');
    return saved ? JSON.parse(saved) : INITIAL_COMPETITIONS;
  });

  const [registeredCompIds, setRegisteredCompIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('studentos_registered_comps');
    return saved ? JSON.parse(saved) : ['comp-1'];
  });

  const [houses, setHouses] = useState<HouseDetail[]>(() => {
    const saved = localStorage.getItem('studentos_houses');
    return saved ? JSON.parse(saved) : INITIAL_HOUSES;
  });

  const [clubs, setClubs] = useState<Club[]>(() => {
    const saved = localStorage.getItem('studentos_clubs');
    return saved ? JSON.parse(saved) : INITIAL_CLUBS;
  });

  const [joinedClubIds, setJoinedClubIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('studentos_joined_clubs');
    return saved ? JSON.parse(saved) : ['club-1', 'club-3'];
  });

  const [badges, setBadges] = useState<StudentBadge[]>(() => {
    const saved = localStorage.getItem('studentos_badges');
    return saved ? JSON.parse(saved) : INITIAL_BADGES;
  });

  const [events, setEvents] = useState<SchoolEvent[]>(() => {
    const saved = localStorage.getItem('studentos_events');
    return saved ? JSON.parse(saved) : INITIAL_EVENTS;
  });

  const [polls, setPolls] = useState<SchoolPoll[]>(() => {
    const saved = localStorage.getItem('studentos_polls');
    return saved ? JSON.parse(saved) : INITIAL_POLLS;
  });

  const [gallery, setGallery] = useState<GalleryAlbum[]>(INITIAL_GALLERY);
  const [newsList, setNewsList] = useState<SchoolNews[]>(INITIAL_NEWS);

  // Supabase Realtime Sync
  const loadAllLifeData = async () => {
    try {
      const [comps, evs, clbs, bdgs, gal, hses, pls, nws] = await Promise.all([
        fetchCompetitions(),
        fetchSchoolEvents(),
        fetchClubs(),
        fetchBadges(),
        fetchGallery(),
        fetchHouses(),
        fetchPolls(),
        fetchNews()
      ]);

      setCompetitions(comps);
      setEvents(evs);
      setClubs(clbs);
      setBadges(bdgs);
      setGallery(gal);
      if (hses.length > 0) setHouses(hses);
      setPolls(pls);
      setNewsList(nws);
    } catch (err) {
      console.warn("Error fetching Supabase Life data:", err);
    }
  };

  useEffect(() => {
    loadAllLifeData();

    // Subscribe to realtime changes for all life tables
    const unsubComp = subscribeToLifeTable('life_competitions', loadAllLifeData);
    const unsubEvent = subscribeToLifeTable('life_events', loadAllLifeData);
    const unsubClub = subscribeToLifeTable('life_clubs', loadAllLifeData);
    const unsubBadge = subscribeToLifeTable('life_achievements', loadAllLifeData);
    const unsubGallery = subscribeToLifeTable('life_gallery', loadAllLifeData);
    const unsubHouse = subscribeToLifeTable('life_houses', loadAllLifeData);
    const unsubPoll = subscribeToLifeTable('life_polls', loadAllLifeData);

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
  const [leaderboardCategory, setLeaderboardCategory] = useState<'Academic' | 'Competition' | 'Sports' | 'Attendance' | 'House' | 'Club'>('Academic');
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'Weekly' | 'Monthly' | 'Yearly'>('Monthly');

  // Modals
  const [showCreateCompModal, setShowCreateCompModal] = useState(false);
  const [showAwardBadgeModal, setShowAwardBadgeModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<GalleryAlbum | null>(null);

  // Form State
  const [newCompForm, setNewCompForm] = useState({
    title: '', description: '', category: 'Coding' as CompetitionCategory,
    startDate: '', endDate: '', location: '', mode: 'Hybrid' as any,
    type: 'Individual' as any, eligibility: 'All Grades', prizePool: ''
  });

  const [newBadgeForm, setNewBadgeForm] = useState({
    title: 'Top Performer', category: 'Academic', icon: '🏆',
    awardedToName: '', reason: ''
  });

  const [newEventForm, setNewEventForm] = useState({
    title: '', category: 'Competition' as any, date: '', time: '', location: '', description: ''
  });

  const [newPollForm, setNewPollForm] = useState({
    question: '', category: 'Best House' as any, optionsText: ''
  });

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem('studentos_competitions', JSON.stringify(competitions));
  }, [competitions]);

  useEffect(() => {
    localStorage.setItem('studentos_registered_comps', JSON.stringify(registeredCompIds));
  }, [registeredCompIds]);

  useEffect(() => {
    localStorage.setItem('studentos_houses', JSON.stringify(houses));
  }, [houses]);

  useEffect(() => {
    localStorage.setItem('studentos_clubs', JSON.stringify(clubs));
  }, [clubs]);

  useEffect(() => {
    localStorage.setItem('studentos_joined_clubs', JSON.stringify(joinedClubIds));
  }, [joinedClubIds]);

  useEffect(() => {
    localStorage.setItem('studentos_badges', JSON.stringify(badges));
  }, [badges]);

  useEffect(() => {
    localStorage.setItem('studentos_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('studentos_polls', JSON.stringify(polls));
  }, [polls]);

  // Handlers
  const handleRegisterCompetition = (compId: string) => {
    if (registeredCompIds.includes(compId)) {
      setRegisteredCompIds(prev => prev.filter(id => id !== compId));
      setCompetitions(prev => prev.map(c => c.id === compId ? { ...c, registeredCount: Math.max(0, c.registeredCount - 1) } : c));
    } else {
      setRegisteredCompIds(prev => [...prev, compId]);
      setCompetitions(prev => prev.map(c => c.id === compId ? { ...c, registeredCount: c.registeredCount + 1 } : c));
    }
  };

  const handleToggleClub = (clubId: string) => {
    if (joinedClubIds.includes(clubId)) {
      setJoinedClubIds(prev => prev.filter(id => id !== clubId));
      setClubs(prev => prev.map(cl => cl.id === clubId ? { ...cl, memberCount: Math.max(0, cl.memberCount - 1) } : cl));
    } else {
      setJoinedClubIds(prev => [...prev, clubId]);
      setClubs(prev => prev.map(cl => cl.id === clubId ? { ...cl, memberCount: cl.memberCount + 1 } : cl));
    }
  };

  const handleVotePoll = (pollId: string, optionId: string) => {
    setPolls(prev => prev.map(p => {
      if (p.id !== pollId) return p;
      const updatedOptions = p.options.map(opt => {
        if (opt.id === optionId) {
          return { ...opt, votes: opt.votes + 1 };
        }
        return opt;
      });
      return {
        ...p,
        options: updatedOptions,
        totalVotes: p.totalVotes + 1,
        userVotedOptionId: optionId
      };
    }));
  };

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompForm.title.trim()) return;
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
      bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80',
      createdAt: new Date().toISOString().split('T')[0]
    };
    setCompetitions(prev => [created, ...prev]);
    await createCompetition(created);
    setShowCreateCompModal(false);
    setNewCompForm({
      title: '', description: '', category: 'Coding', startDate: '', endDate: '',
      location: '', mode: 'Hybrid', type: 'Individual', eligibility: 'All Grades', prizePool: ''
    });
  };

  const handleAwardBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBadgeForm.awardedToName.trim()) return;
    const newB: StudentBadge = {
      id: `badge-${Date.now()}`,
      title: newBadgeForm.title,
      icon: newBadgeForm.icon,
      category: newBadgeForm.category,
      awardedToUid: `u-${Date.now()}`,
      awardedToName: newBadgeForm.awardedToName,
      awardedBy: currentUser.name || 'Teacher',
      reason: newBadgeForm.reason || 'Outstanding dedication and achievement.',
      awardedAt: new Date().toISOString().split('T')[0]
    };
    setBadges(prev => [newB, ...prev]);
    await awardBadge(newB);
    setShowAwardBadgeModal(false);
    setNewBadgeForm({ title: 'Top Performer', category: 'Academic', icon: '🏆', awardedToName: '', reason: '' });
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventForm.title.trim()) return;
    const ev: SchoolEvent = {
      id: `ev-${Date.now()}`,
      title: newEventForm.title,
      category: newEventForm.category,
      date: newEventForm.date || new Date().toISOString().split('T')[0],
      time: newEventForm.time || '10:00 AM',
      location: newEventForm.location || 'School Auditorium',
      description: newEventForm.description || 'Important school activity.',
      createdBy: currentUser.name
    };
    setEvents(prev => [...prev, ev]);
    await createSchoolEvent(ev);
    setShowAddEventModal(false);
    setNewEventForm({ title: '', category: 'Competition', date: '', time: '', location: '', description: '' });
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPollForm.question.trim()) return;
    const opts = newPollForm.optionsText.split(',').map((t, idx) => ({
      id: `opt-${Date.now()}-${idx}`,
      text: t.trim() || `Option ${idx + 1}`,
      votes: 0
    }));
    const newP: SchoolPoll = {
      id: `poll-${Date.now()}`,
      question: newPollForm.question,
      category: newPollForm.category,
      options: opts.length > 0 ? opts : [{ id: 'opt-1', text: 'Yes', votes: 0 }, { id: 'opt-2', text: 'No', votes: 0 }],
      totalVotes: 0,
      createdBy: currentUser.name || 'Student Council',
      createdAt: new Date().toISOString().split('T')[0],
      isActive: true
    };
    setPolls(prev => [newP, ...prev]);
    await createPoll(newP);
    setShowCreatePollModal(false);
    setNewPollForm({ question: '', category: 'Best House', optionsText: '' });
  };

  // Mock Leaderboard users
  const MOCK_LEADERBOARD = [
    { rank: 1, name: 'Aarav Sharma', grade: 'Grade 11', house: 'Ruby', points: 2850, avatar: '🦁', badge: '🏆 Top Scholar' },
    { rank: 2, name: 'Rohan Mehta', grade: 'Grade 10', house: 'Emerald', points: 2640, avatar: '🦅', badge: '⭐ 100% Attendance' },
    { rank: 3, name: 'Kavya Singh', grade: 'Grade 12', house: 'Sapphire', points: 2510, avatar: '🐉', badge: '🥇 Chess Champ' },
    { rank: 4, name: 'Ananya Gupta', grade: 'Grade 9', house: 'Ruby', points: 2380, avatar: '💻', badge: '💻 AI Innovator' },
    { rank: 5, name: 'Priya Nair', grade: 'Grade 11', house: 'Topaz', points: 2210, avatar: '🔥', badge: '📚 Debate Captain' },
    { rank: 6, name: 'Siddharth Rao', grade: 'Grade 10', house: 'Emerald', points: 2150, avatar: '🚀', badge: '🤖 Robotics Lead' },
    { rank: 7, name: 'Diya Kapoor', grade: 'Grade 12', house: 'Topaz', points: 2090, avatar: '🎨', badge: '🎨 Master Artist' },
    { rank: 8, name: 'Vikram Joshi', grade: 'Grade 11', house: 'Sapphire', points: 1980, avatar: '🏃', badge: '🏃 Sports MVP' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 border-b border-indigo-500/20 px-4 sm:px-6 py-6 sm:py-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent_70%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-black rounded-full uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Digital School Community
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded-full">
                Phase 5 Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              StudentOS <span className="bg-gradient-to-r from-amber-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">Life</span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              The vibrant heart of school spirit — competitions, house championships, student clubs, live polls, achievement badges, and school memories.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {(currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.role === 'coordinator') && (
              <button
                onClick={() => setShowCreateCompModal(true)}
                className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Create Competition
              </button>
            )}
            <button
              onClick={() => onTriggerOrionAction?.('Show today\'s summary')}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-800/80 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-md whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-amber-400" /> Ask Orion AI
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto mt-6 sm:mt-8 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-white/10">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Sparkles },
            { id: 'competitions', label: 'Competitions', icon: Trophy, count: competitions.filter(c => c.status === 'Live' || c.status === 'Upcoming').length },
            { id: 'leaderboards', label: 'Leaderboards', icon: Flame },
            { id: 'houses', label: 'Houses System', icon: Shield },
            { id: 'clubs', label: 'Clubs', icon: Users, count: clubs.length },
            { id: 'calendar', label: 'School Calendar', icon: Calendar },
            { id: 'achievements', label: 'Achievements & Badges', icon: Award },
            { id: 'gallery', label: 'School Gallery', icon: ImageIcon },
            { id: 'news', label: 'News & Stories', icon: Newspaper },
            { id: 'polls', label: 'Polls & Voting', icon: Vote, count: polls.filter(p => p.isActive).length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-indigo-300 border-indigo-500 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${isActive ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-800 text-slate-400'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
        {/* ================= TAB 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: House Standings */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">House Rankings</span>
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div className="space-y-2">
                  {houses.slice(0, 3).map((h, i) => (
                    <div key={h.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${i === 0 ? 'bg-amber-500 text-slate-950' : i === 1 ? 'bg-slate-300 text-slate-950' : 'bg-amber-700 text-white'}`}>
                          #{i + 1}
                        </span>
                        <span className="font-bold text-slate-200">{h.name.split(' ')[1]}</span>
                      </div>
                      <span className="font-mono font-bold text-amber-400">{h.points} pts</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setActiveTab('houses')} className="mt-4 text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  View Full House Tally <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Card 2: Live Competitions */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Competitions</span>
                  <Trophy className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-2xl font-black text-white mb-1">
                  {competitions.filter(c => c.status === 'Live' || c.status === 'Upcoming').length} Open Events
                </div>
                <p className="text-xs text-slate-400 mb-4">Register your team for Hackathons, Debates & Chess.</p>
                <button onClick={() => setActiveTab('competitions')} className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-bold text-xs rounded-xl transition-all">
                  Browse Competitions
                </button>
              </div>

              {/* Card 3: Clubs Joined */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">School Clubs</span>
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white mb-1">
                  {joinedClubIds.length} Joined
                </div>
                <p className="text-xs text-slate-400 mb-4">Coding, Robotics, Music & Debate Clubs active this week.</p>
                <button onClick={() => setActiveTab('clubs')} className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-bold text-xs rounded-xl transition-all">
                  Manage Clubs
                </button>
              </div>

              {/* Card 4: Recent Badge */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Achievement Wall</span>
                  <Award className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-white mb-1">
                  {badges.length} Badges
                </div>
                <p className="text-xs text-slate-400 mb-4">Awarded for top marks, attendance & competition wins.</p>
                <button onClick={() => setActiveTab('achievements')} className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-bold text-xs rounded-xl transition-all">
                  View Badges
                </button>
              </div>
            </div>

            {/* Middle Section: Featured Live Event Banner & Active Poll */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Featured Competition Hero */}
              <div className="lg:col-span-2 bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
                    <Radio className="w-3 h-3 animate-pulse text-red-400" /> Featured Live Event
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Starts Aug 15</span>
                </div>

                <div className="space-y-2 mb-6">
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    Inter-House Annual Hackathon 2026
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                    Build smart digital solutions, educational web tools, and AI tools for StudentOS. Top 3 teams win cash prizes, rotating trophy, and official merit certificates!
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-4 text-xs text-slate-300 font-medium">
                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-indigo-400" /> Computer Lab</span>
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-400" /> 42 Registered</span>
                    <span className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-amber-400" /> ₹25,000 Prize</span>
                  </div>

                  <button
                    onClick={() => handleRegisterCompetition('comp-1')}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-2 ${
                      registeredCompIds.includes('comp-1')
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                    }`}
                  >
                    {registeredCompIds.includes('comp-1') ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Trophy className="w-4 h-4" />}
                    {registeredCompIds.includes('comp-1') ? 'Registered' : 'Register Team Now'}
                  </button>
                </div>
              </div>

              {/* Live Poll Widget */}
              {polls.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        Realtime School Poll
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{polls[0].totalVotes} Votes</span>
                    </div>

                    <h4 className="text-sm font-black text-white mb-4 leading-snug">
                      {polls[0].question}
                    </h4>

                    <div className="space-y-2.5">
                      {polls[0].options.map(opt => {
                        const pct = polls[0].totalVotes > 0 ? Math.round((opt.votes / polls[0].totalVotes) * 100) : 0;
                        const isVoted = polls[0].userVotedOptionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleVotePoll(polls[0].id, opt.id)}
                            className={`w-full p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                              isVoted
                                ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200'
                                : 'bg-slate-950 border-white/5 hover:border-white/10 text-slate-300'
                            }`}
                          >
                            <div
                              className="absolute top-0 bottom-0 left-0 bg-indigo-600/20 pointer-events-none transition-all"
                              style={{ width: `${pct}%` }}
                            />
                            <div className="flex items-center justify-between relative z-10 text-xs font-bold">
                              <span className="flex items-center gap-2">
                                {isVoted && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                                {opt.text}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">{pct}%</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('polls')}
                    className="mt-4 text-center text-xs font-bold text-indigo-400 hover:text-indigo-300"
                  >
                    View All School Polls →
                  </button>
                </div>
              )}
            </div>

            {/* School News & Upcoming Events Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* School News */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-indigo-400" /> School News & Stories
                  </h3>
                  <button onClick={() => setActiveTab('news')} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">
                    View All
                  </button>
                </div>

                <div className="space-y-4">
                  {newsList.map(item => (
                    <div key={item.id} className="p-4 rounded-2xl bg-slate-950 border border-white/5 flex gap-4 items-start">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.title} className="w-20 h-20 rounded-xl object-cover shrink-0 border border-white/10" />
                      )}
                      <div className="space-y-1">
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-black rounded-md uppercase">
                          {item.category}
                        </span>
                        <h4 className="text-xs font-bold text-white line-clamp-1">{item.title}</h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{item.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calendar Snapshot */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-400" /> School Calendar Snapshot
                  </h3>
                  <button onClick={() => setActiveTab('calendar')} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">
                    Open Calendar
                  </button>
                </div>

                <div className="space-y-3">
                  {events.map(ev => (
                    <div key={ev.id} className="p-3.5 rounded-2xl bg-slate-950 border border-white/5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center shrink-0">
                          <span className="text-[10px] font-mono text-indigo-300 uppercase block font-bold">{ev.date.split('-')[1]}</span>
                          <span className="text-sm font-black text-white font-mono">{ev.date.split('-')[2]}</span>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{ev.title}</h4>
                          <span className="text-[10px] text-slate-400">{ev.time || 'All Day'} • {ev.location}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-slate-900 text-slate-300 border border-white/10 text-[10px] font-bold rounded-lg shrink-0">
                        {ev.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: COMPETITIONS ================= */}
        {activeTab === 'competitions' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Filter & Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-none">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Category:</span>
                {['All', 'Coding', 'Robotics', 'Debate', 'Chess', 'Science Fair', 'Sports'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCompCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      compCategoryFilter === cat
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {(currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.role === 'coordinator') && (
                <button
                  onClick={() => setShowCreateCompModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add New Competition
                </button>
              )}
            </div>

            {/* Competitions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitions
                .filter(c => compCategoryFilter === 'All' || c.category === compCategoryFilter)
                .map(comp => {
                  const isRegistered = registeredCompIds.includes(comp.id);
                  return (
                    <div key={comp.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between group hover:border-indigo-500/40 transition-all">
                      <div>
                        {/* Banner */}
                        <div className="h-40 relative overflow-hidden bg-slate-950">
                          {comp.bannerUrl && (
                            <img src={comp.bannerUrl} alt={comp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                          )}
                          <div className="absolute top-3 left-3 flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-slate-950/80 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase rounded-lg">
                              {comp.category}
                            </span>
                            <span className={`px-2.5 py-1 backdrop-blur-md text-[10px] font-black uppercase rounded-lg ${
                              comp.status === 'Live' ? 'bg-red-500/80 text-white' : comp.status === 'Upcoming' ? 'bg-amber-500/80 text-slate-950' : 'bg-emerald-500/80 text-white'
                            }`}>
                              {comp.status}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-3">
                          <h3 className="text-base font-extrabold text-white tracking-tight leading-snug">
                            {comp.title}
                          </h3>
                          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                            {comp.description}
                          </p>

                          <div className="space-y-1.5 pt-2 border-t border-white/5 text-[11px] text-slate-300 font-medium">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Dates:</span>
                              <span className="font-mono text-slate-200">{comp.startDate} to {comp.endDate}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Eligibility:</span>
                              <span className="text-indigo-300">{comp.eligibility}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Type / Mode:</span>
                              <span>{comp.type} ({comp.mode})</span>
                            </div>
                            {comp.prizePool && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Prize:</span>
                                <span className="text-amber-400 font-bold">{comp.prizePool}</span>
                              </div>
                            )}
                          </div>

                          {/* Winners section if completed */}
                          {comp.winners && comp.winners.length > 0 && (
                            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">🏆 Official Winners</span>
                              {comp.winners.map(w => (
                                <div key={w.rank} className="flex items-center justify-between text-[11px]">
                                  <span className="text-white font-bold">#{w.rank} {w.name} ({w.house})</span>
                                  <span className="text-amber-400 font-mono text-[10px]">{w.prize}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer CTA */}
                      <div className="p-5 pt-0">
                        <button
                          onClick={() => handleRegisterCompetition(comp.id)}
                          className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                            isRegistered
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                          }`}
                        >
                          {isRegistered ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Trophy className="w-4 h-4" />}
                          {isRegistered ? 'Registered (Click to Cancel)' : 'Register for Competition'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ================= TAB 3: LEADERBOARDS ================= */}
        {activeTab === 'leaderboards' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
              {/* Category Filter */}
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-none">
                {(['Academic', 'Competition', 'Sports', 'Attendance', 'House', 'Club'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setLeaderboardCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      leaderboardCategory === cat
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {cat} Points
                  </button>
                ))}
              </div>

              {/* Timeframe Filter */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/5">
                {(['Weekly', 'Monthly', 'Yearly'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setLeaderboardTimeframe(tf)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      leaderboardTimeframe === tf ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Top 3 Podium */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              {/* Rank 2 */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-xl md:order-1 flex flex-col justify-between items-center relative overflow-hidden">
                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-300 flex items-center justify-center text-3xl shadow-lg mb-3">
                  {MOCK_LEADERBOARD[1].avatar}
                </div>
                <span className="px-3 py-1 bg-slate-300 text-slate-950 font-black text-xs rounded-full uppercase mb-2">#2 Silver Leader</span>
                <h3 className="text-lg font-black text-white">{MOCK_LEADERBOARD[1].name}</h3>
                <p className="text-xs text-slate-400 mb-3">{MOCK_LEADERBOARD[1].grade} • House {MOCK_LEADERBOARD[1].house}</p>
                <div className="px-4 py-2 bg-slate-950 rounded-xl font-mono text-amber-400 font-bold text-sm border border-white/5">
                  {MOCK_LEADERBOARD[1].points} Points
                </div>
              </div>

              {/* Rank 1 (Gold - Center & Elevated) */}
              <div className="bg-gradient-to-b from-indigo-900/60 to-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 text-center shadow-2xl md:order-2 flex flex-col justify-between items-center relative overflow-hidden scale-105">
                <div className="absolute top-2 right-2 text-2xl animate-bounce">👑</div>
                <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-xl mb-3">
                  {MOCK_LEADERBOARD[0].avatar}
                </div>
                <span className="px-3.5 py-1 bg-amber-500 text-slate-950 font-black text-xs rounded-full uppercase mb-2 shadow-md">#1 Gold Champion</span>
                <h3 className="text-xl font-black text-white">{MOCK_LEADERBOARD[0].name}</h3>
                <p className="text-xs text-indigo-300 mb-3">{MOCK_LEADERBOARD[0].grade} • House {MOCK_LEADERBOARD[0].house}</p>
                <div className="px-5 py-2.5 bg-slate-950 rounded-xl font-mono text-amber-300 font-black text-base border border-amber-500/30 shadow-inner">
                  {MOCK_LEADERBOARD[0].points} Points
                </div>
              </div>

              {/* Rank 3 */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-xl md:order-3 flex flex-col justify-between items-center relative overflow-hidden">
                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-amber-700 flex items-center justify-center text-3xl shadow-lg mb-3">
                  {MOCK_LEADERBOARD[2].avatar}
                </div>
                <span className="px-3 py-1 bg-amber-700 text-white font-black text-xs rounded-full uppercase mb-2">#3 Bronze Leader</span>
                <h3 className="text-lg font-black text-white">{MOCK_LEADERBOARD[2].name}</h3>
                <p className="text-xs text-slate-400 mb-3">{MOCK_LEADERBOARD[2].grade} • House {MOCK_LEADERBOARD[2].house}</p>
                <div className="px-4 py-2 bg-slate-950 rounded-xl font-mono text-amber-400 font-bold text-sm border border-white/5">
                  {MOCK_LEADERBOARD[2].points} Points
                </div>
              </div>
            </div>

            {/* Ranks 4 to 8 Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4">Complete Leaderboard Standings</h3>
              {MOCK_LEADERBOARD.slice(3).map(user => (
                <div key={user.rank} className="p-4 rounded-2xl bg-slate-950 border border-white/5 flex items-center justify-between gap-4 hover:border-indigo-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-black text-xs flex items-center justify-center font-mono">
                      #{user.rank}
                    </span>
                    <span className="text-2xl">{user.avatar}</span>
                    <div>
                      <h4 className="text-sm font-bold text-white">{user.name}</h4>
                      <span className="text-[11px] text-slate-400">{user.grade} • House {user.house}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-bold rounded-lg hidden sm:inline">
                      {user.badge}
                    </span>
                    <span className="font-mono text-amber-400 font-black text-sm">
                      {user.points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 4: HOUSES SYSTEM ================= */}
        {activeTab === 'houses' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Houses Tally Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {houses.map(h => (
                <div key={h.id} className={`bg-gradient-to-b ${h.color} p-6 rounded-3xl border border-white/10 shadow-2xl text-white flex flex-col justify-between space-y-6 relative overflow-hidden group`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                        Rank #{h.rank}
                      </span>
                      <Shield className="w-6 h-6 text-white/80" />
                    </div>

                    <h3 className="text-xl font-black tracking-tight">{h.name}</h3>
                    <p className="text-xs text-white/80 italic font-serif">"{h.motto}"</p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-white/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/70">House Points:</span>
                      <span className="text-2xl font-black font-mono tracking-tight">{h.points}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/80">
                      <span>House Captain:</span>
                      <span className="font-bold">{h.captain}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/80">
                      <span>Trophies Won:</span>
                      <span className="font-bold">{h.trophies} 🏆</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* House Announcements & Rules */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" /> House Championship Guidelines
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Points are awarded for academic top ranks, sports championships, debate victories, perfect attendance, clean campus drives, and club participation. The House with the highest total points at the end of the academic year wins the coveted **StudentOS Championship Shield**.
              </p>
            </div>
          </div>
        )}

        {/* ================= TAB 5: CLUBS ================= */}
        {activeTab === 'clubs' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clubs.map(club => {
                const isJoined = joinedClubIds.includes(club.id);
                return (
                  <div key={club.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-emerald-500/40 transition-all">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-3xl p-2 bg-slate-950 rounded-2xl border border-white/5">{club.icon}</span>
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-black uppercase rounded-lg">
                          {club.category}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-white">{club.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{club.description}</p>
                      </div>

                      <div className="space-y-1.5 pt-3 border-t border-white/5 text-[11px] text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Lead Teacher:</span>
                          <span className="font-bold text-slate-200">{club.leadTeacher}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Student Head:</span>
                          <span className="text-emerald-300 font-bold">{club.studentHead}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Meetings:</span>
                          <span>{club.meetingDays}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Members:</span>
                          <span className="font-mono font-bold text-indigo-300">{club.memberCount} Students</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-5">
                      <button
                        onClick={() => handleToggleClub(club.id)}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                          isJoined
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                        }`}
                      >
                        {isJoined ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <UserPlus className="w-4 h-4" />}
                        {isJoined ? 'Joined Club' : 'Join Club'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 6: SCHOOL CALENDAR ================= */}
        {activeTab === 'calendar' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <div>
                <h3 className="text-base font-extrabold text-white">Official School Calendar</h3>
                <p className="text-xs text-slate-400">Exams, Holidays, Competitions & Parent Meetings</p>
              </div>

              {(currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.role === 'coordinator') && (
                <button
                  onClick={() => setShowAddEventModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Event
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map(ev => (
                <div key={ev.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-amber-500/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-black uppercase rounded-lg">
                      {ev.category}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{ev.date}</span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white mb-1">{ev.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{ev.description}</p>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-300 font-medium">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {ev.time || 'All Day'}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> {ev.location}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 7: ACHIEVEMENTS & BADGES ================= */}
        {activeTab === 'achievements' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <div>
                <h3 className="text-base font-extrabold text-white">Student Achievement Wall</h3>
                <p className="text-xs text-slate-400">Merit Badges & Honors awarded by Teachers</p>
              </div>

              {(currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.role === 'coordinator') && (
                <button
                  onClick={() => setShowAwardBadgeModal(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4" /> Award Badge
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {badges.map(b => (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-purple-500/40 transition-all relative overflow-hidden">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-3xl shrink-0 shadow-lg">
                      {b.icon}
                    </div>
                    <div>
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 text-[9px] font-black uppercase rounded">
                        {b.category}
                      </span>
                      <h4 className="text-base font-extrabold text-white mt-0.5">{b.title}</h4>
                      <p className="text-xs text-indigo-300 font-bold">Awarded to: {b.awardedToName}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-white/5">
                    "{b.reason}"
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/5">
                    <span>Awarded by: {b.awardedBy}</span>
                    <span className="font-mono">{b.awardedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 8: GALLERY ================= */}
        {activeTab === 'gallery' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gallery.map(album => (
                <div
                  key={album.id}
                  onClick={() => setSelectedAlbum(album)}
                  className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl group cursor-pointer hover:border-indigo-500/40 transition-all"
                >
                  <div className="h-48 relative overflow-hidden bg-slate-950">
                    <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-slate-950/80 backdrop-blur-md text-white text-[10px] font-black uppercase rounded-lg border border-white/10">
                      {album.category}
                    </span>
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/70 text-amber-300 text-xs font-mono font-bold rounded-lg backdrop-blur-md">
                      {album.photoCount} Photos
                    </span>
                  </div>

                  <div className="p-5">
                    <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">{album.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono block mt-1">Uploaded {album.createdAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 9: NEWS & STORIES ================= */}
        {activeTab === 'news' && (
          <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
            {newsList.map(item => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.title} className="w-full h-64 object-cover rounded-2xl border border-white/10" />
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-black uppercase rounded-lg">
                      {item.category}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{item.publishedAt}</span>
                  </div>
                  <h3 className="text-xl font-black text-white">{item.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.content}</p>
                </div>
                <div className="text-[11px] text-slate-400 pt-3 border-t border-white/5">
                  Published by: <span className="text-slate-200 font-bold">{item.author}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= TAB 10: POLLS & VOTING ================= */}
        {activeTab === 'polls' && (
          <div className="space-y-6 animate-fadeIn max-w-3xl mx-auto">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <div>
                <h3 className="text-base font-extrabold text-white">School Voting & Polls</h3>
                <p className="text-xs text-slate-400">Cast your vote on school activities, house choices & feedback</p>
              </div>

              {(currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.role === 'coordinator') && (
                <button
                  onClick={() => setShowCreatePollModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Create Poll
                </button>
              )}
            </div>

            <div className="space-y-6">
              {polls.map(poll => (
                <div key={poll.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-black uppercase rounded-lg">
                      {poll.category}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{poll.totalVotes} Total Votes</span>
                  </div>

                  <h3 className="text-base font-black text-white">{poll.question}</h3>

                  <div className="space-y-3">
                    {poll.options.map(opt => {
                      const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                      const isVoted = poll.userVotedOptionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleVotePoll(poll.id, opt.id)}
                          className={`w-full p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                            isVoted
                              ? 'bg-indigo-950/80 border-indigo-500/60 text-indigo-200'
                              : 'bg-slate-950 border-white/5 hover:border-indigo-500/30 text-slate-300'
                          }`}
                        >
                          <div
                            className="absolute top-0 bottom-0 left-0 bg-indigo-600/25 pointer-events-none transition-all"
                            style={{ width: `${pct}%` }}
                          />
                          <div className="flex items-center justify-between relative z-10 text-xs font-bold">
                            <span className="flex items-center gap-2">
                              {isVoted && <Check className="w-4 h-4 text-indigo-400" />}
                              {opt.text}
                            </span>
                            <span className="font-mono text-slate-300">{pct}% ({opt.votes} votes)</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}
      {/* 1. Create Competition Modal */}
      {showCreateCompModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-white">Create New Competition</h3>
            <form onSubmit={handleCreateCompetition} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newCompForm.title}
                  onChange={e => setNewCompForm({ ...newCompForm, title: e.target.value })}
                  placeholder="e.g. Inter-House Robotics Sprint"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Category</label>
                  <select
                    value={newCompForm.category}
                    onChange={e => setNewCompForm({ ...newCompForm, category: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    {['Debate', 'Quiz', 'Coding', 'Chess', 'Drawing', 'Science Fair', 'Sports', 'Robotics'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Mode</label>
                  <select
                    value={newCompForm.mode}
                    onChange={e => setNewCompForm({ ...newCompForm, mode: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="Hybrid">Hybrid</option>
                    <option value="Offline">Offline</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newCompForm.description}
                  onChange={e => setNewCompForm({ ...newCompForm, description: e.target.value })}
                  placeholder="Details about rules, format, eligibility..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setShowCreateCompModal(false)} className="px-4 py-2 text-slate-400 hover:text-white font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md">Create Competition</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Award Badge Modal */}
      {showAwardBadgeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-white">Award Student Badge</h3>
            <form onSubmit={handleAwardBadge} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={newBadgeForm.awardedToName}
                  onChange={e => setNewBadgeForm({ ...newBadgeForm, awardedToName: e.target.value })}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Badge Title</label>
                  <select
                    value={newBadgeForm.title}
                    onChange={e => {
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
                    <option value="Top Performer">Top Performer 🏆</option>
                    <option value="Perfect Attendance">Perfect Attendance ⭐</option>
                    <option value="Competition Winner">Competition Winner 🥇</option>
                    <option value="Coding Champion">Coding Champion 💻</option>
                    <option value="Book Lover">Book Lover 📚</option>
                    <option value="Artist">Artist 🎨</option>
                    <option value="Athlete">Athlete 🏃</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Category</label>
                  <input
                    type="text"
                    value={newBadgeForm.category}
                    onChange={e => setNewBadgeForm({ ...newBadgeForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Reason / Citation</label>
                <textarea
                  rows={3}
                  value={newBadgeForm.reason}
                  onChange={e => setNewBadgeForm({ ...newBadgeForm, reason: e.target.value })}
                  placeholder="e.g. For scoring 100% in math midterms and assisting peers."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setShowAwardBadgeModal(false)} className="px-4 py-2 text-slate-400 hover:text-white font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-md">Award Badge</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Event Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-white">Add Calendar Event</h3>
            <form onSubmit={handleAddEvent} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={newEventForm.title}
                  onChange={e => setNewEventForm({ ...newEventForm, title: e.target.value })}
                  placeholder="e.g. Annual Sports Day Practice"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newEventForm.date}
                    onChange={e => setNewEventForm({ ...newEventForm, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Category</label>
                  <select
                    value={newEventForm.category}
                    onChange={e => setNewEventForm({ ...newEventForm, category: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    {['Holiday', 'Exam', 'Competition', 'Parent Meeting', 'Sports Day', 'Annual Day', 'Cultural'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setShowAddEventModal(false)} className="px-4 py-2 text-slate-400 hover:text-white font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md">Add Event</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Create Poll Modal */}
      {showCreatePollModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-white">Create School Poll</h3>
            <form onSubmit={handleCreatePoll} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Poll Question</label>
                <input
                  type="text"
                  required
                  value={newPollForm.question}
                  onChange={e => setNewPollForm({ ...newPollForm, question: e.target.value })}
                  placeholder="e.g. Which topic should be covered in the next workshop?"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Options (Comma Separated)</label>
                <input
                  type="text"
                  required
                  value={newPollForm.optionsText}
                  onChange={e => setNewPollForm({ ...newPollForm, optionsText: e.target.value })}
                  placeholder="Option 1, Option 2, Option 3"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setShowCreatePollModal(false)} className="px-4 py-2 text-slate-400 hover:text-white font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md">Publish Poll</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentOSLife;
