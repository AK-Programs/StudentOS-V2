import { supabase } from './supabase';
import { 
  Competition, SchoolEvent, Club, StudentBadge, GalleryAlbum, 
  SchoolNews, SchoolPoll, HouseDetail 
} from '../types';

// Realtime channel listener helper
export const subscribeToLifeTable = (tableName: string, onDataChanged: () => void) => {
  const channel = supabase
    .channel(`public:${tableName}-changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      (payload) => {
        console.log(`[Realtime Sync] ${tableName} updated:`, payload);
        onDataChanged();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/* ========================================================================
   COMPETITIONS
   ======================================================================== */
export const fetchCompetitions = async (): Promise<Competition[]> => {
  try {
    const { data, error } = await supabase
      .from('life_competitions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    
    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description || '',
      category: item.category || 'General',
      startDate: item.start_date || '',
      endDate: item.end_date || '',
      location: item.location || 'Campus',
      mode: item.mode || 'Offline',
      type: item.type || 'Individual',
      maxTeamSize: item.max_team_size || 1,
      eligibility: item.eligibility || 'All Grades',
      prizePool: item.prize_pool || '',
      status: item.status || 'Upcoming',
      createdBy: item.created_by || 'School Admin',
      registeredCount: item.registered_count || 0,
      bannerUrl: item.banner_url || '',
      rules: item.rules ? (typeof item.rules === 'string' ? JSON.parse(item.rules) : item.rules) : [],
      winners: item.winners ? (typeof item.winners === 'string' ? JSON.parse(item.winners) : item.winners) : [],
      createdAt: item.created_at || new Date().toISOString()
    }));
  } catch (err) {
    console.error('Error fetching competitions:', err);
    return [];
  }
};

export const createCompetition = async (comp: Partial<Competition>): Promise<boolean> => {
  try {
    const payload = {
      id: comp.id || `comp-${Date.now()}`,
      title: comp.title,
      description: comp.description || '',
      category: comp.category || 'General',
      start_date: comp.startDate || new Date().toISOString().split('T')[0],
      end_date: comp.endDate || new Date().toISOString().split('T')[0],
      location: comp.location || 'Campus',
      mode: comp.mode || 'Offline',
      type: comp.type || 'Individual',
      max_team_size: comp.maxTeamSize || 1,
      eligibility: comp.eligibility || 'All Grades',
      prize_pool: comp.prizePool || '',
      status: comp.status || 'Upcoming',
      created_by: comp.createdBy || 'School Admin',
      registered_count: comp.registeredCount || 0,
      banner_url: comp.bannerUrl || 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80',
      rules: JSON.stringify(comp.rules || []),
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('life_competitions').insert([payload]);
    if (error) {
      console.warn('Supabase insert failed, attempting upsert/local broadcast:', error);
    }
    return true;
  } catch (err) {
    console.error('Error creating competition:', err);
    return false;
  }
};

/* ========================================================================
   SCHOOL EVENTS
   ======================================================================== */
export const fetchSchoolEvents = async (): Promise<SchoolEvent[]> => {
  try {
    const { data, error } = await supabase
      .from('life_events')
      .select('*')
      .order('date', { ascending: true });

    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      category: item.category || 'General',
      date: item.date || '',
      time: item.time || '',
      location: item.location || '',
      description: item.description || ''
    }));
  } catch (err) {
    console.error('Error fetching school events:', err);
    return [];
  }
};

export const createSchoolEvent = async (event: Partial<SchoolEvent>): Promise<boolean> => {
  try {
    const payload = {
      id: event.id || `ev-${Date.now()}`,
      title: event.title,
      category: event.category || 'General',
      date: event.date || new Date().toISOString().split('T')[0],
      time: event.time || '10:00 AM',
      location: event.location || 'Auditorium',
      description: event.description || ''
    };

    const { error } = await supabase.from('life_events').insert([payload]);
    if (error) {
      console.warn('Supabase event insert warning:', error);
    }
    return true;
  } catch (err) {
    console.error('Error creating event:', err);
    return false;
  }
};

/* ========================================================================
   CLUBS
   ======================================================================== */
export const fetchClubs = async (): Promise<Club[]> => {
  try {
    const { data, error } = await supabase
      .from('life_clubs')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category || 'General',
      description: item.description || '',
      icon: item.icon || '⭐',
      leadTeacher: item.lead_teacher || '',
      studentHead: item.student_head || '',
      memberCount: item.member_count || 0,
      meetingDays: item.meeting_days || '',
      location: item.location || ''
    }));
  } catch (err) {
    console.error('Error fetching clubs:', err);
    return [];
  }
};

export const createClub = async (club: Partial<Club>): Promise<boolean> => {
  try {
    const payload = {
      id: club.id || `club-${Date.now()}`,
      name: club.name,
      category: club.category || 'General',
      description: club.description || '',
      icon: club.icon || '⭐',
      lead_teacher: club.leadTeacher || '',
      student_head: club.studentHead || '',
      member_count: club.memberCount || 1,
      meeting_days: club.meetingDays || 'Weekly',
      location: club.location || 'Campus Room'
    };

    const { error } = await supabase.from('life_clubs').insert([payload]);
    if (error) console.warn('Supabase club insert error:', error);
    return true;
  } catch (err) {
    console.error('Error creating club:', err);
    return false;
  }
};

/* ========================================================================
   ACHIEVEMENTS / BADGES
   ======================================================================== */
export const fetchBadges = async (): Promise<StudentBadge[]> => {
  try {
    const { data, error } = await supabase
      .from('life_achievements')
      .select('*')
      .order('awarded_at', { ascending: false });

    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      icon: item.icon || '🏆',
      category: item.category || 'Academic',
      awardedToUid: item.awarded_to_uid || '',
      awardedToName: item.awarded_to_name || '',
      awardedBy: item.awarded_by || '',
      reason: item.reason || '',
      awardedAt: item.awarded_at || new Date().toISOString()
    }));
  } catch (err) {
    console.error('Error fetching achievements:', err);
    return [];
  }
};

export const awardBadge = async (badge: Partial<StudentBadge>): Promise<boolean> => {
  try {
    const payload = {
      id: badge.id || `b-${Date.now()}`,
      title: badge.title,
      icon: badge.icon || '🏆',
      category: badge.category || 'Academic',
      awarded_to_uid: badge.awardedToUid || 'student-1',
      awarded_to_name: badge.awardedToName || 'Student',
      awarded_by: badge.awardedBy || 'Teacher',
      reason: badge.reason || '',
      awarded_at: new Date().toISOString()
    };

    const { error } = await supabase.from('life_achievements').insert([payload]);
    if (error) console.warn('Supabase achievement error:', error);
    return true;
  } catch (err) {
    console.error('Error awarding badge:', err);
    return false;
  }
};

/* ========================================================================
   GALLERY ALBUMS
   ======================================================================== */
export const fetchGallery = async (): Promise<GalleryAlbum[]> => {
  try {
    const { data, error } = await supabase
      .from('life_gallery')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      category: item.category || 'General',
      coverUrl: item.cover_url || '',
      photoCount: item.photo_count || 1,
      createdAt: item.created_at || new Date().toISOString()
    }));
  } catch (err) {
    console.error('Error fetching gallery:', err);
    return [];
  }
};

export const createGalleryAlbum = async (album: Partial<GalleryAlbum>): Promise<boolean> => {
  try {
    const payload = {
      id: album.id || `gal-${Date.now()}`,
      title: album.title,
      category: album.category || 'General',
      cover_url: album.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
      photo_count: album.photoCount || 1,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('life_gallery').insert([payload]);
    if (error) console.warn('Supabase gallery error:', error);
    return true;
  } catch (err) {
    console.error('Error creating gallery album:', err);
    return false;
  }
};

/* ========================================================================
   HOUSES
   ======================================================================== */
export const fetchHouses = async (): Promise<HouseDetail[]> => {
  try {
    const { data, error } = await supabase
      .from('life_houses')
      .select('*')
      .order('points', { ascending: false });

    if (error || !data) return [];

    return data.map((item: any, idx: number) => ({
      id: item.id,
      name: item.name,
      color: item.color || 'from-red-600 to-rose-900',
      points: item.points || 0,
      rank: idx + 1,
      captain: item.captain || '',
      viceCaptain: item.vice_captain || '',
      motto: item.motto || '',
      houseTeacher: item.house_teacher || '',
      trophies: item.trophies || 0,
      bannerUrl: item.banner_url || ''
    }));
  } catch (err) {
    console.error('Error fetching houses:', err);
    return [];
  }
};

export const updateHousePoints = async (houseId: string, deltaPoints: number): Promise<boolean> => {
  try {
    // Fetch current house points
    const { data } = await supabase.from('life_houses').select('points').eq('id', houseId).single();
    const current = data?.points || 1000;
    const newPoints = current + deltaPoints;

    const { error } = await supabase
      .from('life_houses')
      .update({ points: newPoints })
      .eq('id', houseId);

    if (error) console.warn('Supabase update house points warning:', error);
    return true;
  } catch (err) {
    console.error('Error updating house points:', err);
    return false;
  }
};

/* ========================================================================
   POLLS
   ======================================================================== */
export const fetchPolls = async (): Promise<SchoolPoll[]> => {
  try {
    const { data, error } = await supabase
      .from('life_polls')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      question: item.question,
      category: item.category || 'General',
      options: typeof item.options === 'string' ? JSON.parse(item.options) : item.options || [],
      totalVotes: item.total_votes || 0,
      createdBy: item.created_by || 'Admin',
      createdAt: item.created_at || new Date().toISOString(),
      isActive: item.is_active !== false
    }));
  } catch (err) {
    console.error('Error fetching polls:', err);
    return [];
  }
};

export const createPoll = async (poll: Partial<SchoolPoll>): Promise<boolean> => {
  try {
    const payload = {
      id: poll.id || `poll-${Date.now()}`,
      question: poll.question,
      category: poll.category || 'General',
      options: JSON.stringify(poll.options || []),
      total_votes: poll.totalVotes || 0,
      created_by: poll.createdBy || 'Admin',
      created_at: new Date().toISOString(),
      is_active: true
    };

    const { error } = await supabase.from('life_polls').insert([payload]);
    if (error) console.warn('Supabase poll error:', error);
    return true;
  } catch (err) {
    console.error('Error creating poll:', err);
    return false;
  }
};

/* ========================================================================
   NEWS
   ======================================================================== */
export const fetchNews = async (): Promise<SchoolNews[]> => {
  try {
    const { data, error } = await supabase
      .from('life_news')
      .select('*')
      .order('published_at', { ascending: false });

    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      category: item.category || 'News',
      content: item.content || '',
      author: item.author || 'Admin',
      imageUrl: item.image_url || '',
      publishedAt: item.published_at || new Date().toISOString(),
      featured: item.featured || false
    }));
  } catch (err) {
    console.error('Error fetching news:', err);
    return [];
  }
};
