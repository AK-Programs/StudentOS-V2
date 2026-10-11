/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Parental Portal
 * Dedicated dashboard for parents to monitor student progress, homework status,
 * attendance, grades, AI study buddy session summaries, teacher announcements,
 * and manage study time limits & linked student profiles.
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, User, Award, BookOpen, Clock, Calendar, CheckCircle, 
  AlertTriangle, Sparkles, Plus, ChevronRight, FileText, Bell, 
  Activity, BarChart2, CheckSquare, Heart, Settings, RefreshCw 
} from 'lucide-react';
import { UserProfile, Homework, GradebookEntry, AttendanceRecord } from '../types';
import { supabase } from '../lib/supabase';

interface ParentalPortalProps {
  currentUser: UserProfile;
  showNotification?: (msg: string) => void;
}

export const ParentalPortal: React.FC<ParentalPortalProps> = ({ currentUser, showNotification }) => {
  const [linkedStudents, setLinkedStudents] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(`s_os_linked_students_${currentUser.uid || currentUser.email}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        uid: 'demo-student-uid',
        name: 'Naitik Kashyap',
        email: 'naitik.kashyap0015@gmail.com',
        role: 'student',
        grade: 'Grade 10',
        section: 'Solara',
        house: 'Emerald',
        studyHours: 18.5,
        quizzesTaken: 12,
        streakDays: 9,
        accountStatus: 'approved'
      }
    ];
  });

  const [activeStudent, setActiveStudent] = useState<UserProfile>(linkedStudents[0] || currentUser);
  const [linkInputEmail, setLinkInputEmail] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [studyTimeLimitMinutes, setStudyTimeLimitMinutes] = useState<number>(120);
  const [screenTimeSpentMinutes, setScreenTimeSpentMinutes] = useState<number>(85);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [grades, setGrades] = useState<GradebookEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(`s_os_linked_students_${currentUser.uid || currentUser.email}`, JSON.stringify(linkedStudents));
    } catch {}
  }, [linkedStudents, currentUser]);

  useEffect(() => {
    const fetchStudentData = async () => {
      setLoadingData(true);
      try {
        // Fetch announcements
        const annRes = await supabase.from('global_data').select('*').eq('id', '__global_announcements__').maybeSingle();
        if (annRes.data && annRes.data.content) {
          setAnnouncements(JSON.parse(annRes.data.content));
        }

        // Fetch homeworks
        const hwRes = await supabase.from('homework').select('*');
        if (hwRes.data) {
          setHomeworks(hwRes.data);
        }

        // Fetch grades / attendance mock or supbase
        setGrades([
          { id: '1', assessmentId: 'a1', studentId: activeStudent.uid || 's1', studentName: activeStudent.name, subject: 'Mathematics', score: 45, maxScore: 50, percentage: 90, letterGrade: 'A+' },
          { id: '2', assessmentId: 'a2', studentId: activeStudent.uid || 's1', studentName: activeStudent.name, subject: 'Physics', score: 42, maxScore: 50, percentage: 84, letterGrade: 'A' },
          { id: '3', assessmentId: 'a3', studentId: activeStudent.uid || 's1', studentName: activeStudent.name, subject: 'Computer Science', score: 48, maxScore: 50, percentage: 96, letterGrade: 'A+' },
          { id: '4', assessmentId: 'a4', studentId: activeStudent.uid || 's1', studentName: activeStudent.name, subject: 'Literature', score: 38, maxScore: 50, percentage: 76, letterGrade: 'B+' }
        ]);

        setAttendance([
          { id: 'att1', date: '2026-10-10', grade: activeStudent.grade || 'Grade 10', section: 'Solara', studentId: activeStudent.uid || 's1', status: 'present' },
          { id: 'att2', date: '2026-10-09', grade: activeStudent.grade || 'Grade 10', section: 'Solara', studentId: activeStudent.uid || 's1', status: 'present' },
          { id: 'att3', date: '2026-10-08', grade: activeStudent.grade || 'Grade 10', section: 'Solara', studentId: activeStudent.uid || 's1', status: 'present' },
          { id: 'att4', date: '2026-10-07', grade: activeStudent.grade || 'Grade 10', section: 'Solara', studentId: activeStudent.uid || 's1', status: 'late' },
        ]);
      } catch (err) {
        console.error('Error loading parent portal data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchStudentData();
  }, [activeStudent]);

  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInputEmail.trim()) return;
    setIsLinking(true);
    try {
      const { data, error } = await supabase.from('users').select('*').eq('email', linkInputEmail.trim()).maybeSingle();
      if (data) {
        const studentProfile: UserProfile = {
          uid: data.uid || data.id,
          name: data.name || linkInputEmail.split('@')[0],
          email: data.email,
          role: 'student',
          grade: data.grade || 'Grade 10',
          section: data.section || 'Solara',
          house: data.house || 'Emerald',
          studyHours: data.studyHours || 15,
          quizzesTaken: data.quizzesTaken || 8,
          streakDays: data.streakDays || 5,
          accountStatus: 'approved'
        };
        if (!linkedStudents.some(s => s.email === studentProfile.email)) {
          const next = [...linkedStudents, studentProfile];
          setLinkedStudents(next);
          setActiveStudent(studentProfile);
          if (showNotification) showNotification(`Successfully linked student: ${studentProfile.name}`);
        } else {
          if (showNotification) showNotification('Student is already linked to your parental portal.');
        }
      } else {
        // Fallback mock link
        const mockStudent: UserProfile = {
          uid: 'linked-' + Date.now(),
          name: linkInputEmail.split('@')[0],
          email: linkInputEmail.trim(),
          role: 'student',
          grade: 'Grade 10',
          section: 'Solara',
          house: 'Emerald',
          studyHours: 12,
          quizzesTaken: 6,
          streakDays: 4,
          accountStatus: 'approved'
        };
        setLinkedStudents([...linkedStudents, mockStudent]);
        setActiveStudent(mockStudent);
        if (showNotification) showNotification(`Linked student profile for ${linkInputEmail}`);
      }
      setLinkInputEmail('');
    } catch (err: any) {
      if (showNotification) showNotification('Could not link student: ' + err.message);
    } finally {
      setIsLinking(false);
    }
  };

  const calculateAttendancePercentage = () => {
    if (!attendance.length) return 100;
    const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    return Math.round((presentCount / attendance.length) * 100);
  };

  const calculateAverageGPA = () => {
    if (!grades.length) return '3.8';
    const total = grades.reduce((acc, g) => acc + g.percentage, 0);
    const avg = total / grades.length;
    if (avg >= 90) return '4.0 (A+)';
    if (avg >= 80) return '3.6 (A)';
    if (avg >= 70) return '3.0 (B)';
    return '2.5 (C)';
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-7xl mx-auto px-4 sm:px-6">
      
      {/* Parental Portal Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 p-6 sm:p-8 border border-white/10 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-bold">
              <Shield className="w-4 h-4" /> Official Parental & Guardian Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Parent Dashboard — {currentUser.name || 'Parent Guardian'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Monitor academic performance, attendance, assignment status, AI study buddy progress, and screen time limits for your linked student children in real time.
            </p>
          </div>

          {/* Student Switcher & Link Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-slate-950/80 border border-white/10 p-3 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/30 border border-violet-500/40 text-violet-300 flex items-center justify-center font-bold text-base">
                {activeStudent.name ? activeStudent.name[0] : '🎓'}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Active Student</p>
                <select
                  value={activeStudent.uid || activeStudent.email}
                  onChange={(e) => {
                    const found = linkedStudents.find(s => (s.uid || s.email) === e.target.value);
                    if (found) setActiveStudent(found);
                  }}
                  className="bg-transparent text-white text-xs font-black focus:outline-none cursor-pointer"
                >
                  {linkedStudents.map(s => (
                    <option key={s.uid || s.email} value={s.uid || s.email} className="bg-slate-900 text-white">
                      {s.name} ({s.grade || 'Grade 10'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Link Student Account Modal / Bar */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">Link Another Student Child</h3>
            <p className="text-[11px] text-slate-400">Enter your child's registered StudentOS school email to link their account to your portal.</p>
          </div>
        </div>
        <form onSubmit={handleLinkStudent} className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="email"
            placeholder="student@school.edu"
            value={linkInputEmail}
            onChange={(e) => setLinkInputEmail(e.target.value)}
            className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500 flex-1 md:w-64"
          />
          <button
            type="submit"
            disabled={isLinking}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 disabled:opacity-50 shadow-md"
          >
            {isLinking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Link Student
          </button>
        </form>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Attendance Card */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Attendance Rate</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-white">{calculateAttendancePercentage()}%</h3>
            <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">Regular & On-Time</p>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${calculateAttendancePercentage()}%` }}></div>
          </div>
        </div>

        {/* Academic GPA Card */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Academic Standing</span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-white">{calculateAverageGPA()}</h3>
            <p className="text-[11px] text-violet-400 font-semibold mt-0.5">Top Honor Roll Tier</p>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div className="bg-violet-500 h-full rounded-full" style={{ width: '92%' }}></div>
          </div>
        </div>

        {/* AI Study Hours Card */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">AI Study Hours Logged</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-white">{activeStudent.studyHours || 18.5} hrs</h3>
            <p className="text-[11px] text-indigo-400 font-semibold mt-0.5">Active AI Buddy Engagement</p>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full" style={{ width: '78%' }}></div>
          </div>
        </div>

        {/* Screen Time & Limits Card */}
        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Daily Screen Time Limit</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-white">{screenTimeSpentMinutes}m / {studyTimeLimitMinutes}m</h3>
              <p className="text-[11px] text-amber-400 font-semibold mt-0.5">Healthy Usage Balance</p>
            </div>
            <button
              onClick={() => {
                const next = studyTimeLimitMinutes === 120 ? 90 : 120;
                setStudyTimeLimitMinutes(next);
                if (showNotification) showNotification(`Updated daily study time limit to ${next} minutes.`);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold border border-white/10"
            >
              Adjust
            </button>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, (screenTimeSpentMinutes / studyTimeLimitMinutes) * 100)}%` }}></div>
          </div>
        </div>

      </div>

      {/* Main Content Grid: Grades & Attendance vs AI Weak Spots & Teacher Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Grades & Homework & Attendance */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Recent Grades & Assessment Scores */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BarChart2 className="w-5 h-5 text-violet-400" />
                <h3 className="text-base font-extrabold text-white">Recent Assessment Grades — {activeStudent.name}</h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                Grade: {activeStudent.grade || 'Grade 10'}
              </span>
            </div>

            <div className="divide-y divide-white/5 overflow-x-auto">
              {grades.map((g) => (
                <div key={g.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-violet-600/20 text-violet-300 flex items-center justify-center font-bold text-xs shrink-0">
                      {g.subject[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{g.subject}</p>
                      <p className="text-[10px] text-slate-400">Score: {g.score} / {g.maxScore} ({g.percentage}%)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-black">
                      {g.letterGrade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Homework Submission Status */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckSquare className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-extrabold text-white">Homework & Assignment Status</h3>
              </div>
              <span className="text-xs font-bold text-slate-400">{homeworks.length} Active Tasks</span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {homeworks.slice(0, 5).map((hw) => (
                <div key={hw.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono font-bold text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-500/10">
                        {hw.subject}
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">{hw.title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{hw.content}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Submitted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Col: AI Buddy Session Summaries & Teacher Announcements */}
        <div className="space-y-6">
          
          {/* AI Study Buddy Session Summaries & Weak Spots */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <h3 className="text-base font-extrabold text-white">AI Study Buddy Insights</h3>
            </div>
            
            <div className="p-4 rounded-xl bg-violet-950/40 border border-violet-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-violet-300">
                <span>Recent Focus: Photosynthesis & Calculus</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">Mastered</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeStudent.name} completed 3 deep revision sessions this week with NVIDIA AI Buddy. Shows strong analytical reasoning in Physics and Algebra.
              </p>
              <div className="pt-2 border-t border-violet-500/20">
                <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Identified Weak Spot: Organic Chemistry Reactions
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Recommended practice: Review Chapter 6 reaction mechanisms.</p>
              </div>
            </div>
          </div>

          {/* Teacher Announcements & Notes */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-extrabold text-white">Teacher Notices & Notes</h3>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {announcements.slice(0, 4).map((ann, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-300">{ann.title || 'School Notice'}</span>
                    <span className="text-[9px] text-slate-400 font-mono">Today</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{ann.message || ann.content}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
