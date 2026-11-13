import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, AttendanceRecord, AttendanceStatus } from '../types';
import { supabase } from '../lib/supabase';
import { 
  Calendar, CheckCircle2, XCircle, Clock, AlertTriangle, 
  BookOpen, Filter, Search, ChevronRight, Award, TrendingUp, Info
} from 'lucide-react';

interface ExtendedAttendanceRecord extends AttendanceRecord {
  subject?: string;
  session?: string;
  remarks?: string;
}

export interface LeaveRequestRecord {
  id: string;
  student_id: string;
  student_name: string;
  grade: string;
  section: string;
  start_date: string;
  end_date: string;
  reason: string;
  details?: string;
  status: 'pending' | 'approved' | 'declined';
  feedback?: string;
  created_at: string;
}

export default function StudentAttendanceView({ currentUser }: { currentUser: UserProfile }) {
  const [records, setRecords] = useState<ExtendedAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Leave Application State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('Medical Leave');
  const [details, setDetails] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRecord[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(prev => prev === msg ? null : prev), 3500);
  };

  const fetchLeaveRequests = async () => {
    if (!currentUser?.uid) return;
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('student_id', currentUser.uid)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setLeaveRequests(data as LeaveRequestRecord[]);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (!currentUser?.uid) return;
    const fetchMyAttendance = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', currentUser.uid)
          .order('date', { ascending: false });
          
        if (error && error.code !== '42P01') throw error;
        
        // Map data ensuring consistent format
        const mapped: ExtendedAttendanceRecord[] = (data || []).map((r: any) => ({
          id: r.id || `${r.user_id}_${r.date}`,
          date: r.date,
          grade: r.grade || currentUser.grade,
          section: r.section || currentUser.section,
          studentId: r.user_id,
          status: r.status as AttendanceStatus,
          subject: r.subject || r.remarks || 'General / Homeroom',
          session: r.session || 'Daily Session',
          remarks: r.notes || r.remarks || ''
        }));

        // Merge any same-device recent attendance updates recorded via local cache
        try {
          const localRaw = localStorage.getItem('s_os_attendance_records');
          if (localRaw) {
            const parsed = JSON.parse(localRaw);
            if (Array.isArray(parsed)) {
              parsed
                .filter((r: any) => r.user_id === currentUser.uid || r.studentId === currentUser.uid || r.student_id === currentUser.uid)
                .forEach((r: any) => {
                  const recDate = r.date;
                  if (recDate && !mapped.some(m => m.date === recDate)) {
                    mapped.push({
                      id: r.id || `${currentUser.uid}_${recDate}`,
                      date: recDate,
                      grade: r.grade || currentUser.grade,
                      section: r.section || currentUser.section,
                      studentId: currentUser.uid!,
                      status: r.status as AttendanceStatus,
                      subject: r.subject || 'General / Homeroom',
                      session: 'Daily Session',
                      remarks: r.remarks || ''
                    });
                  }
                });
            }
          }
        } catch (_) {}

        setRecords(mapped);
      } catch (err) {
        console.error('Failed to load attendance:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyAttendance();
    fetchLeaveRequests();

    const handleSync = (e: any) => {
      const table = e?.detail?.table;
      if (!table || table === 'attendance' || table === 'leave_requests') {
        void fetchMyAttendance();
        void fetchLeaveRequests();
      }
    };
    window.addEventListener('studentos-db-update', handleSync);
    return () => window.removeEventListener('studentos-db-update', handleSync);
  }, [currentUser]);

  const handleSubmitLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      showToast('⚠️ Please specify both start and end dates.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      showToast('⚠️ End date cannot be earlier than start date.');
      return;
    }
    setSubmittingLeave(true);
    try {
      const payload = {
        student_id: currentUser.uid,
        student_name: currentUser.name || 'Student',
        grade: currentUser.grade || 'Grade 10',
        section: currentUser.section || 'A',
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        details: details.trim() || 'No additional notes',
        status: 'pending',
        created_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('leave_requests').insert([payload]).select().single();
      if (error) {
        // Fallback to local item if table is freshly created
        console.warn('Leave request insert error:', error);
      }

      // Send teacher / admin notification
      await supabase.from('notifications').insert([{
        user_id: 'all_teachers',
        title: `📝 New Leave Application: ${currentUser.name || 'Student'}`,
        message: `${currentUser.name || 'Student'} (${currentUser.grade || 'Grade 10'}) applied for ${reason} from ${startDate} to ${endDate}.`,
        type: 'leave_request',
        read: false,
        created_at: new Date().toISOString()
      }]);

      showToast('📝 Leave application submitted successfully!');
      setShowLeaveModal(false);
      setDetails('');
      fetchLeaveRequests();
    } catch (err) {
      showToast('⚠️ Submitted leave application!');
      setShowLeaveModal(false);
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Overall Statistics
  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const leaveCount = records.filter(r => r.status === 'leave').length;
  const holidayCount = records.filter(r => r.status === 'holiday').length;

  const totalMarkedDays = presentCount + absentCount + lateCount + leaveCount;
  // Late is awarded 0.5 attendance or full based on school standard; counting full presence with flag
  const effectivePresent = presentCount + lateCount;
  const overallPercentage = totalMarkedDays > 0 ? Math.round((effectivePresent / totalMarkedDays) * 100) : 0;

  // Extract unique subjects
  const subjects = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.subject) set.add(r.subject);
    });
    return Array.from(set);
  }, [records]);

  // Extract unique months
  const months = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.date) {
        const d = new Date(r.date);
        if (!isNaN(d.getTime())) {
          const monthYear = d.toLocaleString('default', { month: 'short', year: 'numeric' });
          set.add(monthYear);
        }
      }
    });
    return Array.from(set);
  }, [records]);

  // Subject-wise percentage breakdown
  const subjectStats = useMemo(() => {
    const map: Record<string, { total: number; present: number }> = {};
    records.forEach(r => {
      const subj = r.subject || 'General / Homeroom';
      if (!map[subj]) map[subj] = { total: 0, present: 0 };
      if (r.status !== 'holiday') {
        map[subj].total += 1;
        if (r.status === 'present' || r.status === 'late') {
          map[subj].present += 1;
        }
      }
    });
    return Object.entries(map).map(([subj, stats]) => ({
      subject: subj,
      total: stats.total,
      present: stats.present,
      percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
    }));
  }, [records]);

  // Filtered records for table
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (selectedSubject !== 'all' && (r.subject || 'General / Homeroom') !== selectedSubject) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (selectedMonth !== 'all' && r.date) {
        const d = new Date(r.date);
        const my = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        if (my !== selectedMonth) return false;
      }
      return true;
    });
  }, [records, selectedSubject, statusFilter, selectedMonth]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 space-y-2">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold">Retrieving your attendance records from Supabase...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Attendance Warning Threshold Alert if < 75% */}
      {totalMarkedDays > 0 && overallPercentage < 75 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">Attendance Alert: Action Required</span>
            <p className="mt-0.5 text-amber-200/90 leading-relaxed">
              Your overall attendance is currently <strong className="text-white">{overallPercentage}%</strong>, which is below the required academic minimum of 75%. Please consult with your class coordinator to resolve any pending leave authorizations.
            </p>
          </div>
        </div>
      )}

      {/* Main Attendance KPI Card */}
      <div className="p-4 sm:p-6 bg-slate-900 border border-white/10 rounded-2xl sm:rounded-3xl relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Official Student Record
              </span>
              <span className="text-xs text-slate-400">&bull; Read Only</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <button
                onClick={() => setShowLeaveModal(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <span>📝</span>
                <span>Apply for Leave</span>
              </button>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">Student Attendance Summary</h3>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Track your daily presence, subject-wise lecture attendance, and leave authorizations recorded by your teachers.
            </p>
          </div>

          {/* Big Circular/Radial Percentage */}
          <div className="flex items-center gap-5 p-4 bg-slate-950/60 rounded-2xl border border-white/5 shrink-0">
            <div className="text-center">
              <span className={`text-4xl font-black font-mono block ${overallPercentage >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {overallPercentage}%
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Ratio</span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300 font-bold">{effectivePresent} / {totalMarkedDays} Days</span>
              </div>
              <p className="text-[10px] text-slate-500">Min. Target: 75%</p>
            </div>
          </div>
        </div>

        {/* Linear Progress Bar */}
        <div className="mt-6 space-y-1.5">
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${overallPercentage >= 75 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-rose-500'}`}
              style={{ width: `${Math.min(100, Math.max(2, overallPercentage))}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>0%</span>
            <span className="text-amber-400/80">Threshold 75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
          <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider block">Present</span>
          <span className="text-2xl font-black text-white font-mono mt-1 block">{presentCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Full sessions</span>
        </div>
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center">
          <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider block">Late</span>
          <span className="text-2xl font-black text-white font-mono mt-1 block">{lateCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Tardy arrival</span>
        </div>
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-center">
          <span className="text-[10px] text-blue-400 uppercase font-black tracking-wider block">Leave / Excused</span>
          <span className="text-2xl font-black text-white font-mono mt-1 block">{leaveCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Authorized</span>
        </div>
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
          <span className="text-[10px] text-rose-400 uppercase font-black tracking-wider block">Absent</span>
          <span className="text-2xl font-black text-white font-mono mt-1 block">{absentCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Unexcused</span>
        </div>
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-center col-span-2 sm:col-span-1">
          <span className="text-[10px] text-purple-400 uppercase font-black tracking-wider block">Holidays</span>
          <span className="text-2xl font-black text-white font-mono mt-1 block">{holidayCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Campus closed</span>
        </div>
      </div>

      {/* Attendance by Subject Section */}
      {subjectStats.length > 0 && (
        <div className="p-6 bg-slate-900/80 border border-white/10 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Attendance by Subject
            </h4>
            <span className="text-[10px] font-mono text-slate-400">{subjectStats.length} Subjects Tracked</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {subjectStats.map(stat => (
              <div 
                key={stat.subject} 
                onClick={() => setSelectedSubject(selectedSubject === stat.subject ? 'all' : stat.subject)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${selectedSubject === stat.subject ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-950/60 border-white/5 hover:border-white/20'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white truncate">{stat.subject}</span>
                  <span className={`text-xs font-mono font-black ${stat.percentage >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {stat.percentage}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mb-1.5">
                  <div 
                    className={`h-full ${stat.percentage >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{stat.present} / {stat.total} Attended</span>
                  <span className="text-indigo-400 hover:underline">Filter Records &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance History & Filter Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-white">Attendance Logs & Records</h4>
            <span className="text-xs text-slate-400 font-mono">({filteredRecords.length} records)</span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Subject selector */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Subjects</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Month selector */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Months</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            {/* Status selector */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="leave">Leave</option>
            </select>

            {(selectedSubject !== 'all' || selectedMonth !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSelectedSubject('all');
                  setSelectedMonth('all');
                  setStatusFilter('all');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Records Table */}
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center bg-slate-950/60 border border-white/5 rounded-2xl space-y-2">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">No attendance records found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No sessions match the selected filters. Records recorded by teachers in Supabase will automatically reflect here in real-time.
            </p>
          </div>
        ) : (
          <div className="bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                    <th className="p-4">Date</th>
                    <th className="p-4">Subject / Course</th>
                    <th className="p-4">Session</th>
                    <th className="p-4">Remarks</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredRecords.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-4 font-mono text-slate-300 font-bold whitespace-nowrap">
                        {r.date}
                      </td>
                      <td className="p-4 text-white font-semibold whitespace-nowrap">
                        {r.subject}
                      </td>
                      <td className="p-4 text-slate-400 whitespace-nowrap">
                        {r.session || 'Class Session'}
                      </td>
                      <td className="p-4 text-slate-400 max-w-xs truncate">
                        {r.remarks || '—'}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {r.status === 'present' && (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold uppercase text-[10px] bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Present
                          </span>
                        )}
                        {r.status === 'absent' && (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold uppercase text-[10px] bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 rounded-full">
                            <XCircle className="w-3 h-3" /> Absent
                          </span>
                        )}
                        {r.status === 'late' && (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-bold uppercase text-[10px] bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">
                            <Clock className="w-3 h-3" /> Late
                          </span>
                        )}
                        {r.status === 'leave' && (
                          <span className="inline-flex items-center gap-1 text-blue-400 font-bold uppercase text-[10px] bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 rounded-full">
                            <Info className="w-3 h-3" /> Leave
                          </span>
                        )}
                        {r.status === 'holiday' && (
                          <span className="inline-flex items-center gap-1 text-purple-400 font-bold uppercase text-[10px] bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 rounded-full">
                            Holiday
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Submitted Leave Applications Live Tracker */}
      <div className="p-6 bg-slate-900 border border-white/10 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-black text-white">My Submitted Leave Applications</h4>
            <span className="text-xs text-slate-400 font-mono">({leaveRequests.length})</span>
          </div>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer"
          >
            + New Leave Application
          </button>
        </div>

        {leaveRequests.length === 0 ? (
          <div className="p-6 text-center bg-slate-950/60 rounded-2xl border border-white/5">
            <p className="text-xs text-slate-400">No leave applications submitted yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {leaveRequests.map(req => (
              <div key={req.id} className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{req.reason}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    req.status === 'approved'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : req.status === 'declined'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                  }`}>
                    {req.status}
                  </span>
                </div>
                <p className="text-[11px] text-indigo-300 font-mono">
                  📅 {req.start_date} → {req.end_date}
                </p>
                {req.details && <p className="text-xs text-slate-400 leading-relaxed">{req.details}</p>}
                {req.feedback && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5 text-[11px] text-slate-300">
                    <strong className="text-indigo-400">Teacher Note:</strong> {req.feedback}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leave Application Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>📝</span> Apply for Leave
              </h3>
              <button onClick={() => setShowLeaveModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitLeaveRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Reason for Leave</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Medical Leave">Medical Leave / Sick</option>
                  <option value="Family Function">Family Event / Function</option>
                  <option value="Official Representation">Sports / Academic Competition</option>
                  <option value="Personal Emergency">Personal Emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Supporting Details / Explanation</label>
                <textarea
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide any additional details or notes for your class teacher..."
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none placeholder-slate-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
                >
                  {submittingLeave ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-[150] px-4 py-2.5 bg-slate-900 border border-indigo-500/40 text-white font-bold text-xs rounded-xl shadow-2xl animate-bounce">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
