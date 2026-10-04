import { supabase } from '../lib/supabase';
import React, { useState, useEffect } from 'react';
import { Calendar, Users, ShieldAlert, Check, Plus, Trash2, ArrowRight, Bell, Clock, BookOpen , X } from 'lucide-react';

export interface SubstituteAssignment {
  id: string;
  classGrade: string; // e.g. "Grade 10 Solara"
  period: string; // e.g. "Period 3 (10:30 - 11:30)"
  subject: string; // e.g. "Mathematics"
  absentTeacherName: string;
  substituteTeacherName: string;
  workAssigned: string;
  status: 'Assigned' | 'In Progress' | 'Completed';
  date: string; // YYYY-MM-DD
}

const DEFAULT_TEACHERS = [
  'Dr. Sarah Jenkins',
  'Prof. Alex Mercer',
  'Mrs. Clara Higgins',
  'Mr. Raj Patel',
  'Miss Emma Watson',
  'Mr. Bruce Wayne',
  'Ms. Diana Prince'
];

const DEFAULT_CLASSES = [
  'Grade 9 Astra',
  'Grade 9 Elara',
  'Grade 10 Solara',
  'Grade 10 Vega',
  'Grade 11 Astra',
  'Grade 12 Vega'
];

const DEFAULT_PERIODS = [
  'Period 1 (08:30 - 09:30)',
  'Period 2 (09:30 - 10:30)',
  'Period 3 (10:45 - 11:45)',
  'Period 4 (11:45 - 12:45)',
  'Period 5 (13:30 - 14:30)',
  'Period 6 (14:30 - 15:30)'
];

const DEFAULT_SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English Literature',
  'Computer Science',
  'History & Civics',
  'Geography'
];

export const SubstituteHub = ({ currentUser, effectiveRole, showNotification }: any) => {
  const [assignments, setAssignments] = useState<SubstituteAssignment[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'assignments' | 'emergencies' | 'swaps'>('assignments');
  const [swaps, setSwaps] = useState<any[]>([]);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [dynamicTeachers, setDynamicTeachers] = useState<string[]>(DEFAULT_TEACHERS);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('name')
          .in('role', ['teacher', 'coordinator', 'admin', 'super_admin']);
        if (data && data.length > 0) {
          const names = Array.from(new Set(data.map((d: any) => d.name).filter(Boolean)));
          if (names.length > 0) setDynamicTeachers(names);
        }
      } catch (e) {}
    };
    fetchTeachers();
  }, []);

  // Emergency Leave Swap State
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emDate, setEmDate] = useState(new Date().toISOString().split('T')[0]);
  const [emClass, setEmClass] = useState(DEFAULT_CLASSES[0]);
  const [emPeriod, setEmPeriod] = useState(DEFAULT_PERIODS[0]);
  const [emSubject, setEmSubject] = useState(DEFAULT_SUBJECTS[0]);
  const [emOrigTeacher, setEmOrigTeacher] = useState(currentUser?.name || DEFAULT_TEACHERS[0]);
  const [emSubTeacher, setEmSubTeacher] = useState(DEFAULT_TEACHERS[1]);
  const [emReason, setEmReason] = useState('');

  // Lecture Swap State
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swTeacherA, setSwTeacherA] = useState(currentUser?.name || DEFAULT_TEACHERS[0]);
  const [swTeacherB, setSwTeacherB] = useState(DEFAULT_TEACHERS[1]);
  const [swClass, setSwClass] = useState(DEFAULT_CLASSES[0]);
  const [swSubject, setSwSubject] = useState(DEFAULT_SUBJECTS[0]);
  const [swPeriod, setSwPeriod] = useState(DEFAULT_PERIODS[0]);
  const [swDate, setSwDate] = useState(new Date().toISOString().split('T')[0]);
  
  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const { data: swapsData } = await supabase.from('substitute_hub').select('data').eq('id', 'global_swaps').maybeSingle();
        if (swapsData && swapsData.data) setSwaps(JSON.parse(swapsData.data));
        
        const { data: emergData } = await supabase.from('substitute_hub').select('data').eq('id', 'global_emergencies').maybeSingle();
        if (emergData && emergData.data) setEmergencies(JSON.parse(emergData.data));
      } catch(e){}
    };
    fetchStorage();
  }, []);
  
  const saveSwaps = async (list: any[]) => { 
    setSwaps(list); 
    await supabase.from('substitute_hub').upsert({ id: 'global_swaps', data: JSON.stringify(list) }); 
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('s_os_notification_created', {
        detail: { title: '🔄 Lecture Swap Update', message: 'A lecture swap update has been posted to the Substitute Hub.', type: 'substitute' }
      }));
    }
  };
  const saveEmergencies = async (list: any[]) => { 
    setEmergencies(list); 
    await supabase.from('substitute_hub').upsert({ id: 'global_emergencies', data: JSON.stringify(list) }); 
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('s_os_notification_created', {
        detail: { title: '🚨 Emergency Leave Request', message: 'An emergency cover request has been submitted.', type: 'substitute' }
      }));
    }
  };

  const handleCreateEmergencySwap = async () => {
    if (!emReason.trim()) {
      showNotification('⚠️ Please enter a reason for the emergency cover request.');
      return;
    }
    const newReq = {
      id: `emerg_${Date.now()}`,
      teacher: emOrigTeacher,
      origTeacher: emOrigTeacher,
      subTeacher: emSubTeacher,
      classGrade: emClass,
      period: emPeriod,
      subject: emSubject,
      reason: emReason,
      date: emDate,
      status: 'pending'
    };
    const updated = [newReq, ...emergencies];
    await saveEmergencies(updated);
    setEmergencyModalOpen(false);
    setEmReason('');
    showNotification('✓ Emergency cover request submitted!');
  };

  const handleCreateLectureSwap = async () => {
    if (swTeacherA === swTeacherB) {
      showNotification('⚠️ Please select two different teachers to swap lectures.');
      return;
    }
    const newSwap = {
      id: `swap_${Date.now()}`,
      teacherA: swTeacherA,
      teacherB: swTeacherB,
      requester: swTeacherA,
      target: swTeacherB,
      classGrade: swClass,
      subject: swSubject,
      period: swPeriod,
      date: swDate,
      status: 'pending'
    };
    const updated = [newSwap, ...swaps];
    await saveSwaps(updated);
    setSwapModalOpen(false);
    showNotification(`✓ Lecture swap request proposed between ${swTeacherA} and ${swTeacherB}!`);
  };


  // Form States
  const [classGrade, setClassGrade] = useState(DEFAULT_CLASSES[0]);
  const [period, setPeriod] = useState(DEFAULT_PERIODS[0]);
  const [subject, setSubject] = useState(DEFAULT_SUBJECTS[0]);
  const [absentTeacher, setAbsentTeacher] = useState(DEFAULT_TEACHERS[0]);
  const [subTeacher, setSubTeacher] = useState(DEFAULT_TEACHERS[1]);
  const [workAssigned, setWorkAssigned] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);

  // Read from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data, error } = await supabase.from('substitute_hub').select('data').eq('id', 'global_substitutes').maybeSingle();
        if (error) throw error;
        if (data && data.data) {
          setAssignments(JSON.parse(data.data));
          return;
        }
      } catch (e) {
        console.warn('Failed to load from Supabase:', e);
      }
      
      const initial: SubstituteAssignment[] = [
        {
          id: 'sub-1',
          classGrade: 'Grade 10 Solara',
          period: 'Period 3 (10:45 - 11:45)',
          subject: 'Physics',
          absentTeacherName: 'Dr. Sarah Jenkins',
          substituteTeacherName: 'Prof. Alex Mercer',
          workAssigned: 'Read Chapter 4 on Electromagnetism and solve exercises 1-5.',
          status: 'Assigned',
          date: new Date().toISOString().split('T')[0]
        },
        {
          id: 'sub-2',
          classGrade: 'Grade 9 Elara',
          period: 'Period 1 (08:30 - 09:30)',
          subject: 'Mathematics',
          absentTeacherName: 'Mrs. Clara Higgins',
          substituteTeacherName: 'Mr. Raj Patel',
          workAssigned: 'Practice quadratic formula worksheets distributed in class.',
          status: 'Completed',
          date: new Date().toISOString().split('T')[0]
        }
      ];
      setAssignments(initial);
    };
    loadData();
  }, []);

  const saveAssignments = async (list: SubstituteAssignment[]) => {
    setAssignments(list);
    try {
      await supabase.from('substitute_hub').upsert({
        id: 'global_substitutes',
        data: JSON.stringify(list),
        updated_at: new Date().toISOString()
      });
    } catch (e) {}
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (absentTeacher === subTeacher) {
      showNotification('⚠️ Absent teacher and substitute teacher cannot be the same person!');
      return;
    }

    const newAssign: SubstituteAssignment = {
      id: `sub-${Date.now()}`,
      classGrade,
      period,
      subject,
      absentTeacherName: absentTeacher,
      substituteTeacherName: subTeacher,
      workAssigned: workAssigned || 'General reading session under supervision.',
      status: 'Assigned',
      date: assignmentDate
    };

    const updated = [newAssign, ...assignments];
    saveAssignments(updated);
    setWorkAssigned('');
    setFormOpen(false);
    showNotification(`✓ Substitute assigned: ${subTeacher} for ${classGrade}`);

    // Trigger local broadcast notification
    try {
      try {
        const { data: notifData } = await supabase.from('substitute_hub').select('data').eq('id', 'global_alerts').maybeSingle();
        const currentAlerts = notifData && notifData.data ? JSON.parse(notifData.data) : [];
        const newAlert = {
          id: `notif-${Date.now()}`,
          title: 'New Substitute Assigned',
          message: `${subTeacher} will conduct ${subject} for ${classGrade} during ${period}.`,
          role: 'all',
          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        const updatedAlerts = [newAlert, ...currentAlerts].slice(0, 20);
        await supabase.from('substitute_hub').upsert({ id: 'global_alerts', data: JSON.stringify(updatedAlerts) });
      } catch (sbErr) {
        console.error('Error saving alert:', sbErr);
      }

      // Dispatch global notification event
      const gEvent = new CustomEvent('s_os_notification_created', {
        detail: {
          title: '📋 Standby Duty Assigned',
          message: `${subTeacher} is assigned to cover ${subject} for ${classGrade} during ${period}.`,
          type: 'substitute'
        }
      });
      window.dispatchEvent(gEvent);
    } catch (_) {}
  };

  const handleDeleteAssignment = (id: string) => {
    if (!confirm('Are you sure you want to delete this substitute assignment?')) return;
    const filtered = assignments.filter(a => a.id !== id);
    saveAssignments(filtered);
    showNotification('✓ Substitute assignment removed.');
  };

  const handleToggleStatus = (id: string) => {
    const updated = assignments.map(a => {
      if (a.id === id) {
        const nextStatus: any = a.status === 'Assigned' ? 'In Progress' : a.status === 'In Progress' ? 'Completed' : 'Assigned';
        return { ...a, status: nextStatus };
      }
      return a;
    });
    saveAssignments(updated);
    showNotification('✓ Assignment status updated.');
  };

  // Roles checking
  const canManage = ['coordinator', 'admin', 'super_admin'].includes(effectiveRole);

  // Filter list based on current user
  const relevantAssignments = assignments.filter(assign => {
    if (effectiveRole === 'student') {
      // Students see assignments for their class grade only
      return assign.classGrade.startsWith(currentUser?.grade || 'Grade 10');
    }
    if (effectiveRole === 'teacher') {
      // Teachers see where they are either the absent teacher or the substitute teacher
      return assign.substituteTeacherName === currentUser?.name || assign.absentTeacherName === currentUser?.name;
    }
    return true; // Staff see all assignments
  });

  // Check if current teacher is subbing today
  const mySubLectures = assignments.filter(a => a.substituteTeacherName === currentUser?.name && a.status !== 'Completed');

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Panel */}
      <div className="bg-slate-900 border border-white/10 p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            📋 Faculty Substitute Hub
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Coordinate standby cover lists, assign class lessons, and notify teachers of substitute schedules automatically.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 shadow-lg"
          >
            <Plus className="w-4.5 h-4.5" /> New Standby Assign
          </button>
        )}
      </div>

      {/* Standby Alert banner for Teachers */}
      {effectiveRole === 'teacher' && mySubLectures.length > 0 && (
        <div className="p-4.5 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex items-start gap-3.5 animate-pulse">
          <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-black text-amber-300 uppercase tracking-wider">⚠️ Substitution Duty Pending Today</h4>
            <p className="text-xs text-slate-300">
              You have been scheduled for <strong>{mySubLectures.length} standby class coverage lectures</strong> today. Please check the assignment grid below for student worksheet details.
            </p>
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0 mb-6">
        <button 
          id="tab-assignments-btn"
          onClick={() => setActiveTab('assignments')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'assignments' ? 'text-indigo-400 border-indigo-500 bg-indigo-500/5 rounded-t-xl' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
        >
          Daily Assignments
        </button>
        <button 
          id="tab-emergencies-btn"
          onClick={() => setActiveTab('emergencies')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'emergencies' ? 'text-rose-400 border-rose-500 bg-rose-500/5 rounded-t-xl' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
        >
          Emergency Leave
        </button>
        <button 
          id="tab-swaps-btn"
          onClick={() => setActiveTab('swaps')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'swaps' ? 'text-teal-400 border-teal-500 bg-teal-500/5 rounded-t-xl' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
        >
          Lecture Swaps
        </button>
      </div>

      {activeTab === 'assignments' && (
        <div className="space-y-6">
          {/* Creation Form */}
          {canManage && formOpen && (
        <form onSubmit={handleCreateAssignment} className="bg-slate-900 border-2 border-indigo-500/20 p-6 rounded-2xl space-y-4 animate-slideDown shadow-2xl">
          <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
            Create Standby Lecture Substitution
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Class Section</label>
              <select
                value={classGrade}
                onChange={e => setClassGrade(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              >
                {DEFAULT_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Period Interval</label>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              >
                {DEFAULT_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Subject Stream</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              >
                {DEFAULT_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Absent Teacher</label>
              <select
                value={absentTeacher}
                onChange={e => setAbsentTeacher(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              >
                {DEFAULT_TEACHERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Standby Substitute Teacher</label>
              <select
                value={subTeacher}
                onChange={e => setSubTeacher(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              >
                {DEFAULT_TEACHERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Effective Date</label>
              <input
                type="date"
                value={assignmentDate}
                onChange={e => setAssignmentDate(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Lesson Work / Tasks Assigned</label>
            <textarea
              placeholder="E.g., complete physics workbook chapter 5 or study lab guidelines..."
              rows={3}
              value={workAssigned}
              onChange={e => setWorkAssigned(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500/40"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 bg-slate-950 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Confirm Cover Duty
            </button>
          </div>
        </form>
      )}

      {/* Main Grid display of assignments */}
      <div className="bg-slate-950/40 border border-white/10 p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4">
        <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
          <span>📅</span> Live Substitute Registry
        </h3>

        {relevantAssignments.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            📋 No substitute assignments active for your filter role today.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relevantAssignments.map(assign => (
              <div
                key={assign.id}
                className="bg-slate-900 border border-white/10 p-5 rounded-2xl hover:border-white/20 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-[9px] font-black uppercase tracking-wider">
                      {assign.classGrade}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest ${
                      assign.status === 'Completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                      assign.status === 'In Progress' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {assign.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-white">{assign.subject} Coverage</h4>

                  {/* substitution mapping diagram */}
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-white/5 space-y-1 text-xs">
                    <p className="text-slate-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      Absent: <strong className="text-slate-200">{assign.absentTeacherName}</strong>
                    </p>
                    <div className="pl-3.5 text-[9px] text-slate-500 font-bold uppercase tracking-widest">substituted by</div>
                    <p className="text-slate-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Cover: <strong className="text-white">{assign.substituteTeacherName}</strong>
                    </p>
                  </div>

                  <div className="space-y-1 text-xs">
                    <p className="text-slate-400 flex items-center gap-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" /> {assign.period}
                    </p>
                    <p className="text-slate-400 flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" /> {assign.date}
                    </p>
                  </div>

                  <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> Assigned Workbook tasks:
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed italic">
                      "{assign.workAssigned}"
                    </p>
                  </div>
                </div>

                {/* Cover controls */}
                <div className="pt-3.5 border-t border-white/5 flex justify-between items-center">
                  {canManage || assign.substituteTeacherName === currentUser?.name ? (
                    <button
                      onClick={() => handleToggleStatus(assign.id)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 rounded-lg flex items-center gap-1 border border-white/5"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Progress Status
                    </button>
                  ) : (
                    <div></div>
                  )}

                  {canManage && (
                    <button
                      onClick={() => handleDeleteAssignment(assign.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      )}


      {activeTab === 'emergencies' && (
        <div className="bg-slate-900/60 rounded-2xl sm:rounded-3xl border border-white/5 p-4 sm:p-6 md:p-8 relative overflow-hidden space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                Emergency Swap & Leave Requests
              </h3>
              <p className="text-xs text-slate-400 mt-1">Specify date, class, section, period, subject, original teacher, substitute, and reason.</p>
            </div>
            {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole) && (
              <button 
                onClick={() => setEmergencyModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500 hover:text-white transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Request Emergency Swap
              </button>
            )}
          </div>

          {/* Emergency Swap Modal */}
          {emergencyModalOpen && (
            <div className="bg-slate-950 border-2 border-rose-500/30 p-5 rounded-2xl space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <h4 className="text-xs font-black uppercase text-rose-400 tracking-wider">New Emergency Cover Request</h4>
                <button onClick={() => setEmergencyModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Effective Date</label>
                  <input type="date" value={emDate} onChange={e => setEmDate(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Class & Section</label>
                  <select value={emClass} onChange={e => setEmClass(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                    {DEFAULT_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Period</label>
                  <select value={emPeriod} onChange={e => setEmPeriod(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                    {DEFAULT_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Subject</label>
                  <select value={emSubject} onChange={e => setEmSubject(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                    {DEFAULT_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Original Teacher</label>
                  <select value={emOrigTeacher} onChange={e => setEmOrigTeacher(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                    {dynamicTeachers.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Substitute Teacher</label>
                  <select value={emSubTeacher} onChange={e => setEmSubTeacher(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                    {dynamicTeachers.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Reason for Emergency Swap</label>
                <input type="text" placeholder="Medical emergency, urgent personal leave, etc." value={emReason} onChange={e => setEmReason(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEmergencyModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-400">Cancel</button>
                <button onClick={handleCreateEmergencySwap} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase">Submit Request</button>
              </div>
            </div>
          )}

          {emergencies.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No emergency requests active.</p>
          ) : (
            <div className="grid gap-3">
              {emergencies.filter(em => {
                if (effectiveRole === 'student') return em.classGrade && em.classGrade.toLowerCase().includes((currentUser?.grade || '').toLowerCase());
                if (effectiveRole === 'teacher') return em.origTeacher === currentUser?.name || em.subTeacher === currentUser?.name || em.teacher === currentUser?.name;
                return true;
              }).map(em => (
                <div key={em.id} className="p-4 rounded-xl bg-slate-950/40 border border-white/5 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{em.origTeacher || em.teacher} → {em.subTeacher || 'Standby'}</h4>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 font-mono">{em.classGrade || 'Grade 10 Solara'}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Subject: <strong>{em.subject || 'General'}</strong> | Period: {em.period || 'Period 1'} | Reason: {em.reason}</p>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">Date: {em.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded uppercase font-bold ${em.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : em.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                      {em.status}
                    </span>
                    {canManage && em.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        <button onClick={() => { const u = emergencies.map(x => x.id === em.id ? {...x, status: 'approved'} : x); saveEmergencies(u); showNotification('Approved emergency leave'); }} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
                        <button onClick={() => { const u = emergencies.map(x => x.id === em.id ? {...x, status: 'denied'} : x); saveEmergencies(u); showNotification('Denied emergency leave'); }} className="text-rose-400 hover:text-rose-300"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'swaps' && (
        <div className="bg-slate-900/60 rounded-2xl sm:rounded-3xl border border-white/5 p-4 sm:p-6 md:p-8 relative overflow-hidden space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-teal-500" />
                Lecture Swap Board
              </h3>
              <p className="text-xs text-slate-400 mt-1">Propose and manage mutual lecture swaps between faculty members.</p>
            </div>
            {['teacher', 'coordinator', 'admin', 'super_admin'].includes(effectiveRole) && (
              <button 
                onClick={() => setSwapModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-bold hover:bg-teal-500 hover:text-white transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Request Lecture Swap
              </button>
            )}
          </div>

          {/* Lecture Swap Modal */}
          {swapModalOpen && (
            <div className="bg-slate-950 border-2 border-teal-500/30 p-5 rounded-2xl space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <h4 className="text-xs font-black uppercase text-teal-400 tracking-wider">New Lecture Swap Proposal</h4>
                <button onClick={() => setSwapModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Teacher A (Requester)</label>
                  <select value={swTeacherA} onChange={e => setSwTeacherA(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                    {dynamicTeachers.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Teacher B (Swap Target)</label>
                  <select value={swTeacherB} onChange={e => setSwTeacherB(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                    {dynamicTeachers.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Class & Section</label>
                  <select value={swClass} onChange={e => setSwClass(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                    {DEFAULT_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Subject Stream</label>
                  <select value={swSubject} onChange={e => setSwSubject(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                    {DEFAULT_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Period</label>
                  <select value={swPeriod} onChange={e => setSwPeriod(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                    {DEFAULT_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Swap Date</label>
                  <input type="date" value={swDate} onChange={e => setSwDate(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setSwapModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-400">Cancel</button>
                <button onClick={handleCreateLectureSwap} className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs uppercase">Submit Lecture Swap</button>
              </div>
            </div>
          )}

          {swaps.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No active lecture swaps.</p>
          ) : (
            <div className="grid gap-3">
              {swaps.filter(sw => {
                if (effectiveRole === 'student') return sw.classGrade && sw.classGrade.toLowerCase().includes((currentUser?.grade || '').toLowerCase());
                if (effectiveRole === 'teacher') return sw.teacherA === currentUser?.name || sw.teacherB === currentUser?.name || sw.requester === currentUser?.name || sw.target === currentUser?.name;
                return true;
              }).map(sw => (
                <div key={sw.id} className="p-4 rounded-xl bg-slate-950/40 border border-white/5 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{sw.teacherA || sw.requester} ↔ {sw.teacherB || sw.target}</h4>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 font-mono">{sw.classGrade || 'Grade 10 Solara'}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Subject: <strong>{sw.subject || 'General'}</strong> | Period: {sw.period || 'Period 1'}</p>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">Date: {sw.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded uppercase font-bold ${sw.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : sw.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                      {sw.status}
                    </span>
                    {(canManage || currentUser?.name === (sw.teacherB || sw.target)) && sw.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        <button onClick={() => { const u = swaps.map(x => x.id === sw.id ? {...x, status: 'approved'} : x); saveSwaps(u); showNotification('Approved lecture swap'); }} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
                        <button onClick={() => { const u = swaps.map(x => x.id === sw.id ? {...x, status: 'denied'} : x); saveSwaps(u); showNotification('Denied lecture swap'); }} className="text-rose-400 hover:text-rose-300"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
