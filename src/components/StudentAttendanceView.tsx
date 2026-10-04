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

export default function StudentAttendanceView({ currentUser }: { currentUser: UserProfile }) {
  const [records, setRecords] = useState<ExtendedAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

        setRecords(mapped);
      } catch (err) {
        console.error('Failed to load attendance:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyAttendance();
  }, [currentUser]);

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
    </div>
  );
}
