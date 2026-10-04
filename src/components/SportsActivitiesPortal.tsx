import { supabase } from '../lib/supabase';
import React, { useState, useEffect } from 'react';
import { Award, Calendar, Users, Trophy, Plus, Trash2, Check, Search, MapPin, Clock } from 'lucide-react';

interface StudentParticipation {
  id: string;
  studentName: string;
  grade: string;
  activity: string;
  role: string; // e.g., Captain, Midfielder, Runner
  status: 'Active' | 'On Leave' | 'Injured';
  hoursLogged: number;
}

interface SchoolEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  type: string; // e.g., Inter-House, Inter-School, Friendly
  status: 'Upcoming' | 'Completed' | 'Cancelled';
}

interface Competition {
  id: string;
  name: string;
  opponent: string;
  sport: string;
  date: string;
  score: string;
  status: 'Won' | 'Lost' | 'Draw' | 'Scheduled';
}

interface Achievement {
  id: string;
  studentName: string;
  sportActivity: string;
  awardName: string; // e.g., Gold Medal, Best Athlete
  level: string; // e.g., National, District, Inter-School
  date: string;
}

export const SportsActivitiesPortal = ({ currentUser, showNotification }: any) => {
  const [activeTab, setActiveTab] = useState<'participation' | 'events' | 'competitions' | 'achievements'>('participation');

  // Core States
  const [participations, setParticipations] = useState<StudentParticipation[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals / Form openers
  const [formOpen, setFormOpen] = useState(false);

  // Draft form states
  const [partDraft, setPartDraft] = useState<Partial<StudentParticipation>>({ status: 'Active', hoursLogged: 2 });
  const [eventDraft, setEventDraft] = useState<Partial<SchoolEvent>>({ status: 'Upcoming' });
  const [compDraft, setCompDraft] = useState<Partial<Competition>>({ status: 'Scheduled' });
  const [achDraft, setAchDraft] = useState<Partial<Achievement>>({ level: 'Inter-School' });

  // Load state from Supabase
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;

    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase.from('sports_activities').select('data').eq('id', `sports_${uid}`).maybeSingle();
        if (error) throw error;
        if (data && data.data) {
          const parsed = JSON.parse(data.data);
          if (parsed.participations) setParticipations(parsed.participations);
          if (parsed.events) setEvents(parsed.events);
          if (parsed.competitions) setCompetitions(parsed.competitions);
          if (parsed.achievements) setAchievements(parsed.achievements);
          return;
        }
      } catch (e) {
        console.warn('Supabase load failed, using defaults:', e);
      }
      
      // Defaults
      setParticipations([
        { id: 'p-1', studentName: 'Aarav Sharma', grade: 'Grade 10', activity: 'Football', role: 'Striker', status: 'Active', hoursLogged: 12 },
        { id: 'p-2', studentName: 'Diya Patel', grade: 'Grade 9', activity: 'Basketball', role: 'Point Guard', status: 'Active', hoursLogged: 15 },
        { id: 'p-3', studentName: 'Kabir Mehta', grade: 'Grade 11', activity: 'Athletics', role: 'Sprinter', status: 'Injured', hoursLogged: 8 }
      ]);
      setEvents([
        { id: 'e-1', title: 'Annual Inter-House Sports Day', date: '2026-10-15', time: '08:00 - 16:00', venue: 'Main Ground', type: 'Inter-House', status: 'Upcoming' },
        { id: 'e-2', title: 'Friendly Match vs St. Xavier Hockey Club', date: '2026-07-28', time: '15:30 - 17:00', venue: 'North Turf', type: 'Friendly', status: 'Upcoming' }
      ]);
      setCompetitions([
        { id: 'c-1', name: 'District Basketball Tournament', opponent: 'DPS Falcons', sport: 'Basketball', date: '2026-06-12', score: '56 - 48', status: 'Won' },
        { id: 'c-2', name: 'Regional Football League', opponent: 'Navy Children School', sport: 'Football', date: '2026-07-20', score: '0 - 0', status: 'Scheduled' }
      ]);
      setAchievements([
        { id: 'a-1', studentName: 'Diya Patel', sportActivity: 'Basketball', awardName: 'Most Valuable Player', level: 'District', date: '2026-06-12' },
        { id: 'a-2', studentName: 'Aarav Sharma', sportActivity: 'Football', awardName: 'Top Scorer Cup', level: 'Inter-School', date: '2026-05-30' }
      ]);
    };
    
    loadFromSupabase();
  }, [currentUser]);

  // Save states helper
  const saveState = (key: string, data: any) => {
    // handled by effect
  };

  useEffect(() => {
    if (!currentUser?.uid) return;
    const uid = currentUser.uid;
    const saveToSupabase = async () => {
      try {
        await supabase.from('sports_activities').upsert({
          id: `sports_${uid}`,
          user_id: uid,
          data: JSON.stringify({ participations, events, competitions, achievements }),
          updated_at: new Date().toISOString()
        });
      } catch (e) {}
    };
    if (participations.length > 0 || events.length > 0 || competitions.length > 0 || achievements.length > 0) {
      const timer = setTimeout(saveToSupabase, 1000);
      return () => clearTimeout(timer);
    }
  }, [participations, events, competitions, achievements, currentUser]);

  const handleAddParticipation = () => {
    if (!partDraft.studentName || !partDraft.activity || !partDraft.role) {
      showNotification('⚠️ Please fill out all required fields.');
      return;
    }
    const newRecord: StudentParticipation = {
      id: `p-${Date.now()}`,
      studentName: partDraft.studentName,
      grade: partDraft.grade || 'Grade 10',
      activity: partDraft.activity,
      role: partDraft.role,
      status: partDraft.status as any || 'Active',
      hoursLogged: Number(partDraft.hoursLogged) || 0
    };
    const updated = [...participations, newRecord];
    setParticipations(updated);
    saveState('part', updated);
    setPartDraft({ status: 'Active', hoursLogged: 2 });
    setFormOpen(false);
    showNotification('✓ Student participation log updated successfully!');
  };

  const handleAddEvent = () => {
    if (!eventDraft.title || !eventDraft.date || !eventDraft.venue) {
      showNotification('⚠️ Please fill out all required fields.');
      return;
    }
    const newRecord: SchoolEvent = {
      id: `e-${Date.now()}`,
      title: eventDraft.title,
      date: eventDraft.date,
      time: eventDraft.time || '15:00 - 16:30',
      venue: eventDraft.venue,
      type: eventDraft.type || 'Inter-School',
      status: eventDraft.status as any || 'Upcoming'
    };
    const updated = [...events, newRecord];
    setEvents(updated);
    saveState('ev', updated);
    setEventDraft({ status: 'Upcoming' });
    setFormOpen(false);
    showNotification('✓ Upcoming athletic/sports event scheduled.');
  };

  const handleAddCompetition = () => {
    if (!compDraft.name || !compDraft.opponent || !compDraft.sport) {
      showNotification('⚠️ Please fill out all required fields.');
      return;
    }
    const newRecord: Competition = {
      id: `c-${Date.now()}`,
      name: compDraft.name,
      opponent: compDraft.opponent,
      sport: compDraft.sport,
      date: compDraft.date || new Date().toISOString().split('T')[0],
      score: compDraft.score || 'N/A',
      status: compDraft.status as any || 'Scheduled'
    };
    const updated = [...competitions, newRecord];
    setCompetitions(updated);
    saveState('comp', updated);
    setCompDraft({ status: 'Scheduled' });
    setFormOpen(false);
    showNotification('✓ Tournament fixture created successfully!');
  };

  const handleAddAchievement = () => {
    if (!achDraft.studentName || !achDraft.sportActivity || !achDraft.awardName) {
      showNotification('⚠️ Please fill out all required fields.');
      return;
    }
    const newRecord: Achievement = {
      id: `a-${Date.now()}`,
      studentName: achDraft.studentName,
      sportActivity: achDraft.sportActivity,
      awardName: achDraft.awardName,
      level: achDraft.level || 'Inter-School',
      date: achDraft.date || new Date().toISOString().split('T')[0]
    };
    const updated = [...achievements, newRecord];
    setAchievements(updated);
    saveState('ach', updated);
    setAchDraft({ level: 'Inter-School' });
    setFormOpen(false);
    showNotification('🏆 Award achievement published on student records!');
  };

  const handleDeleteItem = (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    if (activeTab === 'participation') {
      const updated = participations.filter(p => p.id !== id);
      setParticipations(updated);
      saveState('part', updated);
    } else if (activeTab === 'events') {
      const updated = events.filter(e => e.id !== id);
      setEvents(updated);
      saveState('ev', updated);
    } else if (activeTab === 'competitions') {
      const updated = competitions.filter(c => c.id !== id);
      setCompetitions(updated);
      saveState('comp', updated);
    } else if (activeTab === 'achievements') {
      const updated = achievements.filter(a => a.id !== id);
      setAchievements(updated);
      saveState('ach', updated);
    }
    showNotification('Record removed.');
  };

  // Filter lists based on search
  const filteredParts = participations.filter(p => p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || p.activity.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredEvents = events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.venue.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredComps = competitions.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.sport.toLowerCase().includes(searchQuery.toLowerCase()) || c.opponent.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredAchs = achievements.filter(a => a.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || a.awardName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Panel */}
      <div className="bg-slate-900 border border-white/10 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            ⚽ Sports & Co-Curricular Center
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Log participation, schedule sports events, track league standings, and publish student achievements.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search athletic logs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full md:w-60 bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
            />
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-indigo-600/25"
          >
            <Plus className="w-4 h-4" /> Add Record
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        <button
          onClick={() => { setActiveTab('participation'); setFormOpen(false); }}
          className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
            activeTab === 'participation' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" /> Participation Logs
        </button>
        <button
          onClick={() => { setActiveTab('events'); setFormOpen(false); }}
          className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
            activeTab === 'events' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Calendar className="w-4 h-4" /> School Events
        </button>
        <button
          onClick={() => { setActiveTab('competitions'); setFormOpen(false); }}
          className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
            activeTab === 'competitions' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Trophy className="w-4 h-4" /> Competitions & Tournaments
        </button>
        <button
          onClick={() => { setActiveTab('achievements'); setFormOpen(false); }}
          className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
            activeTab === 'achievements' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Award className="w-4 h-4" /> Achievements & Medals
        </button>
      </div>

      {/* Form Dialog Panel */}
      {formOpen && (
        <div className="bg-slate-900 border-2 border-indigo-500/30 p-6 rounded-2xl animate-slideDown shadow-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <h3 className="text-sm font-black uppercase text-indigo-400 tracking-widest flex items-center gap-2">
              📝 Create Record: {activeTab.toUpperCase()}
            </h3>
            <button onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-white text-xs font-bold uppercase">
              Cancel
            </button>
          </div>

          {activeTab === 'participation' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Student Name"
                value={partDraft.studentName || ''}
                onChange={e => setPartDraft({ ...partDraft, studentName: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Grade Level (e.g., Grade 10)"
                value={partDraft.grade || ''}
                onChange={e => setPartDraft({ ...partDraft, grade: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Activity/Sport"
                value={partDraft.activity || ''}
                onChange={e => setPartDraft({ ...partDraft, activity: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Role (e.g., Goalkeeper, Runner)"
                value={partDraft.role || ''}
                onChange={e => setPartDraft({ ...partDraft, role: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <select
                value={partDraft.status || 'Active'}
                onChange={e => setPartDraft({ ...partDraft, status: e.target.value as any })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white col-span-1"
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Injured">Injured</option>
              </select>
              <input
                type="number"
                placeholder="Practice Hours Logged"
                value={partDraft.hoursLogged || ''}
                onChange={e => setPartDraft({ ...partDraft, hoursLogged: Number(e.target.value) })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <button
                onClick={handleAddParticipation}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider col-span-1 md:col-span-2 hover:bg-indigo-500"
              >
                Save Student Log
              </button>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Event Title"
                value={eventDraft.title || ''}
                onChange={e => setEventDraft({ ...eventDraft, title: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white md:col-span-2"
              />
              <input
                type="date"
                value={eventDraft.date || ''}
                onChange={e => setEventDraft({ ...eventDraft, date: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Time Frame (e.g., 08:00 - 12:00)"
                value={eventDraft.time || ''}
                onChange={e => setEventDraft({ ...eventDraft, time: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Venue"
                value={eventDraft.venue || ''}
                onChange={e => setEventDraft({ ...eventDraft, venue: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white md:col-span-2"
              />
              <select
                value={eventDraft.type || 'Inter-School'}
                onChange={e => setEventDraft({ ...eventDraft, type: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              >
                <option value="Inter-House">Inter-House</option>
                <option value="Inter-School">Inter-School</option>
                <option value="Friendly">Friendly</option>
                <option value="State Trial">State Trial</option>
              </select>
              <button
                onClick={handleAddEvent}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-500"
              >
                Publish Event
              </button>
            </div>
          )}

          {activeTab === 'competitions' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Tournament/Competition Name"
                value={compDraft.name || ''}
                onChange={e => setCompDraft({ ...compDraft, name: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white md:col-span-2"
              />
              <input
                type="text"
                placeholder="Opponent School/Club"
                value={compDraft.opponent || ''}
                onChange={e => setCompDraft({ ...compDraft, opponent: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Sport"
                value={compDraft.sport || ''}
                onChange={e => setCompDraft({ ...compDraft, sport: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="date"
                value={compDraft.date || ''}
                onChange={e => setCompDraft({ ...compDraft, date: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Match Score (e.g., 3 - 2)"
                value={compDraft.score || ''}
                onChange={e => setCompDraft({ ...compDraft, score: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <select
                value={compDraft.status || 'Scheduled'}
                onChange={e => setCompDraft({ ...compDraft, status: e.target.value as any })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
                <option value="Draw">Draw</option>
              </select>
              <button
                onClick={handleAddCompetition}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-500"
              >
                Add Fixture
              </button>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Achiever Student Name"
                value={achDraft.studentName || ''}
                onChange={e => setAchDraft({ ...achDraft, studentName: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Sport/Activity"
                value={achDraft.sportActivity || ''}
                onChange={e => setAchDraft({ ...achDraft, sportActivity: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Award/Medal name"
                value={achDraft.awardName || ''}
                onChange={e => setAchDraft({ ...achDraft, awardName: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <select
                value={achDraft.level || 'Inter-School'}
                onChange={e => setAchDraft({ ...achDraft, level: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              >
                <option value="District">District Tournament</option>
                <option value="Regional">Regional Open</option>
                <option value="State">State Championship</option>
                <option value="National">National Championship</option>
                <option value="Inter-School">Inter-School Meet</option>
              </select>
              <input
                type="date"
                value={achDraft.date || ''}
                onChange={e => setAchDraft({ ...achDraft, date: e.target.value })}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white md:col-span-2"
              />
              <button
                onClick={handleAddAchievement}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider col-span-1 md:col-span-2 hover:bg-indigo-500"
              >
                Record Achievement
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Grid View */}
      <div className="bg-slate-950/40 border border-white/15 p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl min-h-[350px]">
        {activeTab === 'participation' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="pb-3 pl-2">Student</th>
                  <th className="pb-3">Class</th>
                  <th className="pb-3">Sport/Club</th>
                  <th className="pb-3">Position/Role</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Practice Hours</th>
                  <th className="pb-3 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500 font-medium">
                      No student co-curricular logs found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredParts.map(p => (
                    <tr key={p.id} className="hover:bg-white/5 transition-all">
                      <td className="py-3.5 pl-2 font-bold text-white">{p.studentName}</td>
                      <td className="py-3.5">{p.grade}</td>
                      <td className="py-3.5">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20">
                          {p.activity}
                        </span>
                      </td>
                      <td className="py-3.5">{p.role}</td>
                      <td className="py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${
                          p.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          p.status === 'Injured' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-white pr-2">{p.hoursLogged} hrs</td>
                      <td className="py-3.5 text-right pr-2">
                        <button onClick={() => handleDeleteItem(p.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500 font-medium">
                No scheduled activities or sports meets listed.
              </div>
            ) : (
              filteredEvents.map(e => (
                <div key={e.id} className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4 hover:border-indigo-500/40 transition-all flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-0.5 bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded text-[9px] font-bold uppercase tracking-wider">
                        {e.type}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">{e.status}</span>
                    </div>
                    <h4 className="text-sm font-black text-white leading-snug">{e.title}</h4>
                    <div className="space-y-1 text-slate-400 text-xs">
                      <p className="flex items-center gap-1.5 font-mono"><Clock className="w-3.5 h-3.5" /> {e.date} | {e.time}</p>
                      <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {e.venue}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/5 flex justify-end">
                    <button onClick={() => handleDeleteItem(e.id)} className="text-slate-500 hover:text-red-400 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'competitions' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="pb-3 pl-2">League / Competition</th>
                  <th className="pb-3">Sport</th>
                  <th className="pb-3">Versus Opponent</th>
                  <th className="pb-3">Scheduled Date</th>
                  <th className="pb-3 text-center">Live Score</th>
                  <th className="pb-3 text-right pr-2">Outcome Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {filteredComps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500 font-medium">
                      No upcoming or previous league matches listed.
                    </td>
                  </tr>
                ) : (
                  filteredComps.map(c => (
                    <tr key={c.id} className="hover:bg-white/5 transition-all">
                      <td className="py-3.5 pl-2 font-black text-white">{c.name}</td>
                      <td className="py-3.5">
                        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-300 rounded border border-rose-500/20">
                          {c.sport}
                        </span>
                      </td>
                      <td className="py-3.5 font-bold text-slate-200">{c.opponent}</td>
                      <td className="py-3.5 font-mono">{c.date}</td>
                      <td className="py-3.5 text-center font-mono font-extrabold text-white bg-slate-900/40 rounded px-2">{c.score}</td>
                      <td className="py-3.5 text-right pr-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                          c.status === 'Won' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          c.status === 'Lost' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredAchs.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500 font-medium">
                No awards or victory accomplishments logged.
              </div>
            ) : (
              filteredAchs.map(a => (
                <div key={a.id} className="bg-slate-900/40 border border-amber-500/20 p-5 rounded-2xl flex gap-4 hover:border-amber-500/40 transition-all">
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {a.level} Achievement
                      </span>
                      <button onClick={() => handleDeleteItem(a.id)} className="text-slate-600 hover:text-red-400 p-0.5 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h4 className="text-sm font-black text-white truncate">{a.awardName}</h4>
                    <p className="text-xs text-slate-300">Awarded to: <strong className="text-indigo-300">{a.studentName}</strong></p>
                    <p className="text-[11px] text-slate-400 font-mono">Discipline: {a.sportActivity} | Date: {a.date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
