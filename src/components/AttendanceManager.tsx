import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, AttendanceRecord, AttendanceStatus, UserRole } from '../types';
import { fetchAllSupabaseUsers } from '../lib/supabaseUsers';
import { supabase } from '../lib/supabase';
import { sendNotificationToUsers } from '../firebase';
import { 
  Calendar, Check, X, Clock, FileText, Download, 
  Users, AlertTriangle, Filter, CheckCircle2, RefreshCw, BarChart2, Shield
} from 'lucide-react';

const SUBJECT_LIST = [
  'General / Homeroom',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English Literature',
  'Computer Science',
  'History & Civics',
  'Economics',
  'Physical Education'
];

export default function AttendanceManager({ currentUser, effectiveRole }: { currentUser: UserProfile; effectiveRole: UserRole | undefined }) {
  const [activeTab, setActiveTab] = useState<'attendance' | 'analytics' | 'leaves'>('attendance');
  
  // Attendance State
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedGrade, setSelectedGrade] = useState<string>('Grade 10');
  const [selectedSection, setSelectedSection] = useState<string>('Solara');
  const [selectedSubject, setSelectedSubject] = useState<string>('General / Homeroom');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetUsers, setTargetUsers] = useState<UserProfile[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord & { remarks?: string }>>({});
  
  // Historical stats map (studentId -> { present, total, percentage })
  const [historicalStats, setHistoricalStats] = useState<Record<string, { present: number; total: number; percentage: number }>>({});

  // Leave State
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDates, setLeaveDates] = useState('');

  // Target role determination based on hierarchy
  const targetRoleToManage = 
    effectiveRole === 'teacher' ? 'student' :
    effectiveRole === 'coordinator' ? 'student' :
    (effectiveRole === 'admin' || effectiveRole === 'super_admin') ? 'student' : null;

  useEffect(() => {
    if (activeTab === 'attendance' || activeTab === 'analytics') fetchUsersAndAttendance();
    if (activeTab === 'leaves') fetchLeaveRequests();
  }, [date, selectedGrade, selectedSection, selectedSubject, activeTab, effectiveRole]);

  const fetchUsersAndAttendance = async () => {
    if (!targetRoleToManage && effectiveRole !== 'super_admin') return;
    setLoading(true);
    try {
      const allUsers = await fetchAllSupabaseUsers();
      
      let filtered = allUsers.filter(u => u.role === 'student');
      
      // Filter by Grade and Section
      if (selectedGrade !== 'all') {
        filtered = filtered.filter(u => u.grade === selectedGrade);
      }
      if (selectedSection !== 'all') {
        filtered = filtered.filter(u => !u.section || u.section === selectedSection);
      }
      
      setTargetUsers(filtered);

      // Fetch attendance for the selected date
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', date);
        
      if (error && error.code !== '42P01') throw error;

      const attendanceMap: Record<string, AttendanceRecord & { remarks?: string }> = {};
      data?.forEach((rec: any) => {
        attendanceMap[rec.user_id] = {
          id: rec.id,
          date: rec.date,
          grade: selectedGrade,
          section: selectedSection,
          studentId: rec.user_id,
          status: rec.status,
          remarks: rec.remarks || rec.notes
        };
      });
      setAttendance(attendanceMap);

      // Fetch all past attendance to compute historical student percentages
      const { data: allHistory } = await supabase
        .from('attendance')
        .select('user_id, status');

      if (allHistory) {
        const statsMap: Record<string, { present: number; total: number; percentage: number }> = {};
        allHistory.forEach((r: any) => {
          if (!statsMap[r.user_id]) statsMap[r.user_id] = { present: 0, total: 0, percentage: 0 };
          if (r.status !== 'holiday') {
            statsMap[r.user_id].total += 1;
            if (r.status === 'present' || r.status === 'late') {
              statsMap[r.user_id].present += 1;
            }
          }
        });
        Object.keys(statsMap).forEach(uid => {
          const s = statsMap[uid];
          s.percentage = s.total > 0 ? Math.round((s.present / s.total) * 100) : 100;
        });
        setHistoricalStats(statsMap);
      }
    } catch (err: any) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const markStatus = async (uid: string, status: AttendanceStatus) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .upsert({
          user_id: uid,
          date: date,
          status: status,
          grade: selectedGrade,
          section: selectedSection,
          subject: selectedSubject,
          updated_by: currentUser.name || currentUser.email,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, date' });
        
      if (error && error.code !== '42P01') throw error;

      // Update local state immediately for instant feedback
      setAttendance(prev => ({
        ...prev,
        [uid]: {
          id: `${uid}_${date}`,
          date,
          grade: selectedGrade,
          section: selectedSection,
          studentId: uid,
          status
        }
      }));

      // Dispatch alert
      const targetUser = targetUsers.find(u => u.uid === uid);
      if (targetUser) {
        sendNotificationToUsers({
          title: '📝 Attendance Recorded',
          message: `${targetUser.name} was marked "${status.toUpperCase()}" for ${selectedSubject} on ${date}.`,
          type: 'attendance'
        }).catch(e => console.error(e));
      }
    } catch (err: any) {
      console.error('Failed to mark attendance:', err);
    }
  };

  // Bulk action: Mark all visible students present
  const handleMarkAllPresent = async () => {
    if (targetUsers.length === 0) return;
    setLoading(true);
    try {
      const updates = targetUsers.map(u => ({
        user_id: u.uid,
        date: date,
        status: 'present',
        grade: selectedGrade,
        section: selectedSection,
        subject: selectedSubject,
        updated_by: currentUser.name || currentUser.email,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('attendance')
        .upsert(updates, { onConflict: 'user_id, date' });

      if (error && error.code !== '42P01') throw error;

      const newMap = { ...attendance };
      targetUsers.forEach(u => {
        if (u.uid) {
          newMap[u.uid] = {
            id: `${u.uid}_${date}`,
            date,
            grade: selectedGrade,
            section: selectedSection,
            studentId: u.uid,
            status: 'present'
          };
        }
      });
      setAttendance(newMap);
    } catch (err) {
      console.error('Bulk mark error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export to CSV for Admin/Coordinator
  const exportToCSV = () => {
    const rows = [
      ['Date', 'Student Name', 'Email', 'Grade', 'Section', 'Subject', 'Status', 'Historical %']
    ];
    targetUsers.forEach(u => {
      const att = attendance[u.uid!]?.status || 'unmarked';
      const hist = historicalStats[u.uid!]?.percentage ?? 'N/A';
      rows.push([date, u.name, u.email, selectedGrade, selectedSection, selectedSubject, att, `${hist}%`]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${selectedGrade}_${selectedSection}_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchLeaveRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error && error.code !== '42P01') throw error;
      setLeaveRequests(data || []);
    } catch (err: any) {
      console.error('Failed to fetch leaves:', err);
    }
  };

  const applyLeave = async () => {
    if (!leaveReason.trim() || !leaveDates.trim()) return;
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: currentUser.uid,
          user_name: currentUser.name,
          user_role: effectiveRole,
          reason: leaveReason,
          dates: leaveDates,
          status: 'pending'
        });
        
      if (error && error.code !== '42P01') throw error;

      setShowLeaveForm(false);
      setLeaveReason('');
      setLeaveDates('');
      fetchLeaveRequests();
    } catch (err: any) {
      console.error('Failed to apply leave:', err);
    }
  };

  const updateLeaveStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status })
        .eq('id', id);
        
      if (error && error.code !== '42P01') throw error;
      fetchLeaveRequests();
    } catch (err: any) {
      console.error('Failed to update leave:', err);
    }
  };

  // Filter visible students by search
  const visibleStudents = useMemo(() => {
    return targetUsers.filter(u => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });
  }, [targetUsers, searchQuery]);

  // Summary counts for today's selection
  const markedPresentToday = visibleStudents.filter(u => attendance[u.uid!]?.status === 'present').length;
  const markedAbsentToday = visibleStudents.filter(u => attendance[u.uid!]?.status === 'absent').length;
  const markedLateToday = visibleStudents.filter(u => attendance[u.uid!]?.status === 'late').length;
  const unmarkedToday = visibleStudents.length - (markedPresentToday + markedAbsentToday + markedLateToday);

  // At-risk students (< 75% historical)
  const atRiskStudents = useMemo(() => {
    return targetUsers.filter(u => {
      const stats = historicalStats[u.uid!];
      return stats && stats.total >= 3 && stats.percentage < 75;
    });
  }, [targetUsers, historicalStats]);

  return (
    <div className="smart-glass p-3.5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 max-w-7xl mx-auto animate-fadeIn w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">StudentOS Attendance Center</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {effectiveRole?.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Record subject attendance, analyze cohort attendance ratios, and process leave requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 rounded-2xl p-1 border border-white/10 w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-initial text-center ${activeTab === 'attendance' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Daily Records
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-initial text-center ${activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Cohort Analytics
          </button>
          <button 
            onClick={() => setActiveTab('leaves')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-initial text-center ${activeTab === 'leaves' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Leave Requests
          </button>
        </div>
      </div>

      {/* TAB 1: MARK ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Controls Filter Bar */}
          <div className="p-3.5 sm:p-4 bg-slate-950/60 border border-white/10 rounded-2xl space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="w-full px-2.5 sm:px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Grade</label>
                <select 
                  value={selectedGrade} 
                  onChange={e => setSelectedGrade(e.target.value)} 
                  className="w-full px-2.5 sm:px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  {['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Section</label>
                <select 
                  value={selectedSection} 
                  onChange={e => setSelectedSection(e.target.value)} 
                  className="w-full px-2.5 sm:px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  {['Solara', 'Astra', 'Elara', 'Vega'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Subject</label>
                <select 
                  value={selectedSubject} 
                  onChange={e => setSelectedSubject(e.target.value)} 
                  className="w-full px-2.5 sm:px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1 border-t border-white/5">
              {/* Quick search */}
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder="Search student by name or email..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllPresent}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Mark All Present</span>
                </button>

                <button
                  onClick={exportToCSV}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs border border-white/10 transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>CSV Export</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar for Selected Class on Selected Date */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-3 sm:p-3.5 bg-slate-950/60 border border-white/5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Class Roster</span>
                <span className="text-lg sm:text-xl font-black text-white font-mono mt-0.5 block">{visibleStudents.length}</span>
              </div>
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 opacity-60 shrink-0" />
            </div>

            <div className="p-3 sm:p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-400 block">Present</span>
                <span className="text-lg sm:text-xl font-black text-emerald-300 font-mono mt-0.5 block">{markedPresentToday}</span>
              </div>
              <Check className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 opacity-60 shrink-0" />
            </div>

            <div className="p-3 sm:p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-400 block">Late</span>
                <span className="text-lg sm:text-xl font-black text-amber-300 font-mono mt-0.5 block">{markedLateToday}</span>
              </div>
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 opacity-60 shrink-0" />
            </div>

            <div className="p-3 sm:p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-rose-400 block">Absent</span>
                <span className="text-lg sm:text-xl font-black text-rose-300 font-mono mt-0.5 block">{markedAbsentToday}</span>
              </div>
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 opacity-60 shrink-0" />
            </div>
          </div>

          {/* MOBILE VIEW: Touch-optimized Stacked Cards */}
          <div className="block sm:hidden space-y-3">
            {visibleStudents.map(u => {
              const studentAtt = attendance[u.uid!]?.status;
              const stats = historicalStats[u.uid!] || { present: 0, total: 0, percentage: 100 };
              const isLow = stats.total >= 3 && stats.percentage < 75;

              return (
                <div key={u.uid} className="p-4 bg-slate-950/80 border border-white/10 rounded-2xl space-y-3 shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                        {u.name ? u.name[0] : 'S'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-xs truncate">{u.name}</span>
                          {isLow && (
                            <span title="Low Attendance Alert (<75%)" className="text-amber-400 text-xs">⚠️</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 truncate block">{u.email}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`font-mono font-black text-xs ${isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {stats.percentage}%
                      </span>
                      <span className="text-[9px] text-slate-500 block">({stats.present}/{stats.total})</span>
                    </div>
                  </div>

                  {/* Current Status Pill & Quick Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button 
                      onClick={() => markStatus(u.uid!, 'present')} 
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 border ${
                        studentAtt === 'present' 
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-black shadow-md' 
                          : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>Present</span>
                    </button>

                    <button 
                      onClick={() => markStatus(u.uid!, 'late')} 
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 border ${
                        studentAtt === 'late' 
                          ? 'bg-amber-500 border-amber-400 text-slate-950 font-black shadow-md' 
                          : 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-500/20 text-amber-400'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>Late</span>
                    </button>

                    <button 
                      onClick={() => markStatus(u.uid!, 'absent')} 
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 border ${
                        studentAtt === 'absent' 
                          ? 'bg-rose-500 border-rose-400 text-white font-black shadow-md' 
                          : 'bg-rose-950/40 hover:bg-rose-900/60 border-rose-500/20 text-rose-400'
                      }`}
                    >
                      <X className="w-3.5 h-3.5 shrink-0" />
                      <span>Absent</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {visibleStudents.length === 0 && (
              <div className="p-8 text-center bg-slate-950/60 border border-white/10 rounded-2xl text-slate-500 text-xs">
                No students enrolled under {selectedGrade} - Section {selectedSection}.
              </div>
            )}
          </div>

          {/* TABLE VIEW (Tablet & Desktop): Clean responsive table with overflow protection */}
          <div className="hidden sm:block bg-slate-950/60 rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden overflow-x-auto shadow-xl">
            <table className="w-full min-w-[580px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-4">Student</th>
                  <th className="p-4">Cumulative %</th>
                  <th className="p-4">Today's Status</th>
                  <th className="p-4 text-right">Quick Mark Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {visibleStudents.map(u => {
                  const studentAtt = attendance[u.uid!]?.status;
                  const stats = historicalStats[u.uid!] || { present: 0, total: 0, percentage: 100 };
                  const isLow = stats.total >= 3 && stats.percentage < 75;

                  return (
                    <tr key={u.uid} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {u.name ? u.name[0] : 'S'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{u.name}</span>
                              {isLow && (
                                <span title="Low Attendance Alert (<75%)" className="text-amber-400 text-xs">⚠️</span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold text-xs ${isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {stats.percentage}%
                          </span>
                          <span className="text-[10px] text-slate-500">({stats.present}/{stats.total})</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                          studentAtt === 'present' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          studentAtt === 'absent' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          studentAtt === 'late' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {studentAtt || 'Unmarked'}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => markStatus(u.uid!, 'present')} 
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${studentAtt === 'present' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400'}`}
                          >
                            <Check className="w-3 h-3 inline mr-1" />Present
                          </button>
                          <button 
                            onClick={() => markStatus(u.uid!, 'absent')} 
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${studentAtt === 'absent' ? 'bg-rose-500 text-white font-black' : 'bg-rose-600/20 hover:bg-rose-600/40 text-rose-400'}`}
                          >
                            <X className="w-3 h-3 inline mr-1" />Absent
                          </button>
                          <button 
                            onClick={() => markStatus(u.uid!, 'late')} 
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${studentAtt === 'late' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-400'}`}
                          >
                            <Clock className="w-3 h-3 inline mr-1" />Late
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visibleStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-500 text-xs">
                      No students enrolled under {selectedGrade} - Section {selectedSection}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: COHORT ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Alerts Banner */}
          {atRiskStudents.length > 0 && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-sm text-white">Low Attendance Notice ({atRiskStudents.length} Students At Risk)</h4>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                The following students in this cohort have attendance below the 75% school compliance requirement:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {atRiskStudents.map(s => (
                  <span key={s.uid} className="px-2.5 py-1 rounded-xl bg-black/40 border border-amber-500/40 text-[11px] font-bold text-white flex items-center gap-1.5">
                    <span>{s.name}</span>
                    <span className="text-amber-400 font-mono">({historicalStats[s.uid!]?.percentage}%)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown summary */}
          <div className="p-6 bg-slate-950/60 border border-white/10 rounded-2xl space-y-4">
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-400" />
              Cohort Attendance Overview
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Enrolled Cohort</span>
                <span className="text-2xl font-black text-white font-mono block">{targetUsers.length}</span>
                <span className="text-[11px] text-slate-500">{selectedGrade} &bull; {selectedSection}</span>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Cohort Average Ratio</span>
                <span className="text-2xl font-black text-emerald-400 font-mono block">
                  {targetUsers.length > 0 
                    ? Math.round(targetUsers.reduce((acc, u) => acc + (historicalStats[u.uid!]?.percentage || 100), 0) / targetUsers.length)
                    : 0}%
                </span>
                <span className="text-[11px] text-slate-500">Across all marked sessions</span>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Compliance Rate</span>
                <span className="text-2xl font-black text-indigo-400 font-mono block">
                  {targetUsers.length > 0 
                    ? Math.round(((targetUsers.length - atRiskStudents.length) / targetUsers.length) * 100) 
                    : 100}%
                </span>
                <span className="text-[11px] text-slate-500">Students meeting &gt;= 75% rule</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LEAVES */}
      {activeTab === 'leaves' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
            <div>
              <h4 className="text-sm font-bold text-white">Student & Faculty Leaves</h4>
              <p className="text-xs text-slate-400">Process and authorize official leave applications.</p>
            </div>
            <button 
              onClick={() => setShowLeaveForm(!showLeaveForm)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all self-start sm:self-auto"
            >
              + Apply for Leave
            </button>
          </div>

          {showLeaveForm && (
            <div className="bg-slate-950 p-6 rounded-2xl border border-indigo-500/30 space-y-4 animate-fadeIn">
              <h5 className="text-sm font-bold text-white border-b border-white/10 pb-2">Submit Leave Authorization</h5>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Dates Required</label>
                  <input 
                    type="text" 
                    value={leaveDates} 
                    onChange={e => setLeaveDates(e.target.value)} 
                    placeholder="e.g. Oct 12 - Oct 15" 
                    className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Reason for Leave</label>
                  <textarea 
                    value={leaveReason} 
                    onChange={e => setLeaveReason(e.target.value)} 
                    rows={3} 
                    className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-sm" 
                    placeholder="Provide medical or formal academic reason..."
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setShowLeaveForm(false)} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700">Cancel</button>
                  <button onClick={applyLeave} disabled={!leaveReason || !leaveDates} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 disabled:opacity-50">Submit</button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {leaveRequests.map(req => (
              <div key={req.id} className="p-4 bg-slate-900 border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white text-sm">{req.user_name}</span>
                    <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider bg-slate-950 px-2 py-0.5 rounded border border-white/5">{req.user_role}</span>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded tracking-wider ${
                      req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                      req.status === 'rejected' ? 'bg-rose-500/20 text-rose-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>{req.status}</span>
                  </div>
                  <div className="text-xs text-slate-400">Dates: <strong className="text-white">{req.dates}</strong></div>
                  <p className="text-xs text-slate-300 mt-1 italic">"{req.reason}"</p>
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateLeaveStatus(req.id, 'approved')} className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 rounded-lg text-xs font-bold transition-all"><Check className="w-4 h-4" /></button>
                    <button onClick={() => updateLeaveStatus(req.id, 'rejected')} className="px-3 py-1.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 rounded-lg text-xs font-bold transition-all"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            ))}
            {leaveRequests.length === 0 && (
              <div className="p-8 text-center bg-slate-900 border border-white/5 rounded-2xl text-slate-500 text-xs">
                No leave requests found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
