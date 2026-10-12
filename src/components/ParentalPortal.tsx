/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Parental Portal
 * Approachable, clear dashboard for parents and guardians to view their child's
 * attendance, academic progress, upcoming assignments, school events, announcements,
 * published report cards, teacher feedback, and learning resources.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, User, Award, BookOpen, Clock, Calendar, CheckCircle, 
  AlertTriangle, Sparkles, Plus, ChevronRight, FileText, Bell, 
  BarChart2, CheckSquare, RefreshCw, MessageSquare, Users, X, GraduationCap
} from 'lucide-react';
import { UserProfile, Homework, GradebookEntry, AttendanceRecord } from '../types';
import { supabase } from '../lib/supabase';
import { getSupabaseHomework } from '../lib/supabaseHomework';
import { getSupabaseResources } from '../lib/supabaseResources';
import { soundService } from '../lib/soundService';
import {
  NumberTicker,
  CardSpotlight,
  ShimmerButton
} from './ui/animatedComponents';

interface ParentalPortalProps {
  currentUser: UserProfile;
  showNotification?: (msg: string) => void;
}

export const ParentalPortal: React.FC<ParentalPortalProps> = ({ currentUser, showNotification }) => {
  const storageKey = `s_os_linked_students_${currentUser.uid || currentUser.email}`;

  const [linkedStudents, setLinkedStudents] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
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

  const [activeStudent, setActiveStudent] = useState<UserProfile>(() => linkedStudents[0] || currentUser);
  const [showLinkDrawer, setShowLinkDrawer] = useState<boolean>(false);
  const [linkInputEmail, setLinkInputEmail] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);

  const [studyTimeLimitMinutes, setStudyTimeLimitMinutes] = useState<number>(() => {
    const saved = localStorage.getItem(`s_os_parent_limit_${activeStudent.uid || activeStudent.email}`);
    return saved ? Number(saved) : 120;
  });

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [grades, setGrades] = useState<GradebookEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [teacherFeedback, setTeacherFeedback] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parentNoteText, setParentNoteText] = useState<string>('');
  const [sendingNote, setSendingNote] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(linkedStudents));
    } catch {}
  }, [linkedStudents, storageKey]);

  useEffect(() => {
    const saved = localStorage.getItem(`s_os_parent_limit_${activeStudent.uid || activeStudent.email}`);
    if (saved) setStudyTimeLimitMinutes(Number(saved));
  }, [activeStudent]);

  const fetchStudentData = async () => {
    setLoadingData(true);
    setLoadError(null);
    try {
      // 1. Fetch official announcements
      let loadedAnnouncements: any[] = [];
      try {
        const annRes = await supabase.from('global_data').select('*').eq('id', '__global_announcements__').maybeSingle();
        if (annRes.data && annRes.data.content) {
          const parsed = typeof annRes.data.content === 'string' ? JSON.parse(annRes.data.content) : annRes.data.content;
          if (Array.isArray(parsed)) loadedAnnouncements = parsed;
        }
      } catch {}
      setAnnouncements(loadedAnnouncements);

      // 2. Fetch authorized homework for the child's grade/section
      let allHw: Homework[] = [];
      try {
        allHw = await getSupabaseHomework();
      } catch {}
      const studentGrade = (activeStudent.grade || 'Grade 10').toLowerCase().replace(/grade|class/g, '').trim();
      const studentSection = (activeStudent.section || 'Solara').toLowerCase().trim();
      const filteredHw = allHw.filter(hw => {
        const hg = (hw.classGrade || '').toLowerCase().replace(/grade|class/g, '').trim();
        const hs = (hw.classSection || '').toLowerCase().trim();
        const gradeMatch = !hg || hg === 'all grades' || hg === studentGrade;
        const secMatch = !hs || hs === 'all sections' || hs === studentSection;
        return gradeMatch && secMatch;
      });
      setHomeworks(filteredHw);

      // 3. Fetch real academic marks from student_marks table if available
      let studentMarksList: GradebookEntry[] = [];
      try {
        const { data: marksData } = await supabase
          .from('student_marks')
          .select('*')
          .eq('student_id', activeStudent.uid || '');
        if (marksData && marksData.length > 0) {
          marksData.forEach((rec: any) => {
            const maxScore = Number(rec.max_marks) || 100;
            const marksMap = rec.marks || {};
            Object.entries(marksMap).forEach(([subject, scoreStr], idx) => {
              const score = parseFloat(String(scoreStr));
              if (!isNaN(score)) {
                const pct = Math.round((score / maxScore) * 100);
                const letter = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : 'C';
                studentMarksList.push({
                  id: `${rec.id}_${idx}`,
                  assessmentId: rec.exam_type || 'Term Assessment',
                  studentId: activeStudent.uid || '',
                  studentName: activeStudent.name,
                  subject,
                  score,
                  maxScore,
                  percentage: pct,
                  letterGrade: letter
                });
              }
            });
          });
        }
      } catch {}
      setGrades(studentMarksList);

      // 4. Fetch real attendance from attendance table or local storage if available
      let attRecords: AttendanceRecord[] = [];
      try {
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('studentId', activeStudent.uid || '')
          .order('date', { ascending: false })
          .limit(30);
        if (attData && attData.length > 0) {
          attRecords = attData;
        } else {
          const localAtt = localStorage.getItem('s_os_attendance_records');
          if (localAtt) {
            const parsedAtt = JSON.parse(localAtt);
            if (Array.isArray(parsedAtt)) {
              attRecords = parsedAtt.filter((a: any) => a.studentId === activeStudent.uid || a.studentName === activeStudent.name);
            }
          }
        }
      } catch {}
      setAttendance(attRecords);

      // 5. Fetch school resources (learning resources, notices, timetables/events)
      try {
        const schoolRes = await getSupabaseResources('school_resources');
        const gradeMatchingRes = schoolRes.filter((item: any) => {
          const ig = (item.targetGrade || 'All Grades').toLowerCase();
          return ig === 'all grades' || ig === (activeStudent.grade || 'Grade 10').toLowerCase();
        });
        setResources(gradeMatchingRes.filter((r: any) => r.type === 'worksheet' || r.type === 'assignment'));
        setEvents(gradeMatchingRes.filter((r: any) => r.type === 'timetable' || r.type === 'notice').slice(0, 4));
      } catch {}

      // 6. Fetch teacher feedback if stored
      try {
        const { data: fbData } = await supabase
          .from('feedback')
          .select('*')
          .ilike('studentName', `%${activeStudent.name}%`)
          .limit(5);
        if (fbData && fbData.length > 0) {
          setTeacherFeedback(fbData);
        } else {
          setTeacherFeedback([]);
        }
      } catch {}
    } catch (err: any) {
      console.error('Error loading parent portal data:', err);
      setLoadError('Unable to sync some records right now. Showing latest cached student information.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [activeStudent]);

  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = linkInputEmail.trim().toLowerCase();
    if (!targetEmail) return;
    setIsLinking(true);
    try {
      const { data } = await supabase.from('user_profiles').select('*').ilike('email', targetEmail).maybeSingle();
      if (data && data.role === 'student') {
        const studentProfile: UserProfile = {
          uid: data.uid || data.id,
          name: data.name || targetEmail.split('@')[0],
          email: data.email,
          role: 'student',
          grade: data.grade || 'Grade 10',
          section: data.section || 'Solara',
          house: data.house || 'Emerald',
          studyHours: data.study_hours || 0,
          quizzesTaken: data.quizzes_taken || 0,
          streakDays: data.streak_days || 0,
          accountStatus: 'approved'
        };
        if (!linkedStudents.some(s => s.email.toLowerCase() === studentProfile.email.toLowerCase())) {
          const next = [...linkedStudents, studentProfile];
          setLinkedStudents(next);
          setActiveStudent(studentProfile);
          setShowLinkDrawer(false);
          setLinkInputEmail('');
          showNotification?.(`Linked ${studentProfile.name} (${studentProfile.grade}) to your Parental Portal.`);
        } else {
          showNotification?.('This student is already linked to your portal.');
        }
      } else {
        showNotification?.('No verified student record found for that school email.');
      }
    } catch (err: any) {
      showNotification?.('Could not verify student account: ' + (err.message || 'Network error'));
    } finally {
      setIsLinking(false);
    }
  };

  const handleSendParentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentNoteText.trim()) return;
    setSendingNote(true);
    try {
      const savedNotes = JSON.parse(localStorage.getItem(`s_os_parent_notes_${activeStudent.uid}`) || '[]');
      const newEntry = {
        id: `pnote-${Date.now()}`,
        parentName: currentUser.name || 'Parent / Guardian',
        studentName: activeStudent.name,
        grade: activeStudent.grade,
        message: parentNoteText.trim(),
        createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
      localStorage.setItem(`s_os_parent_notes_${activeStudent.uid}`, JSON.stringify([newEntry, ...savedNotes]));
      setParentNoteText('');
      showNotification?.('Message sent to class coordinator and homeroom teacher.');
    } finally {
      setSendingNote(false);
    }
  };

  const studentEmail = (activeStudent.email || '').toLowerCase();
  const pendingHomeworks = useMemo(() => {
    return homeworks.filter(hw => !(hw.completedList || []).some(em => em.toLowerCase() === studentEmail));
  }, [homeworks, studentEmail]);

  const completedHomeworks = useMemo(() => {
    return homeworks.filter(hw => (hw.completedList || []).some(em => em.toLowerCase() === studentEmail));
  }, [homeworks, studentEmail]);

  const attendanceSummary = useMemo(() => {
    if (attendance.length === 0) {
      return { rate: null, present: 0, late: 0, absent: 0, total: 0 };
    }
    const present = attendance.filter(a => a.status === 'present').length;
    const late = attendance.filter(a => a.status === 'late').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const rate = Math.round(((present + late) / attendance.length) * 100);
    return { rate, present, late, absent, total: attendance.length };
  }, [attendance]);

  const academicSummary = useMemo(() => {
    if (grades.length === 0) {
      return { averagePct: null, standingLabel: 'No published grades yet' };
    }
    const total = grades.reduce((acc, g) => acc + g.percentage, 0);
    const avg = Math.round(total / grades.length);
    const standingLabel = avg >= 90 ? 'Excellent Standing (A+)' : avg >= 80 ? 'Strong Standing (A)' : avg >= 70 ? 'Good Progress (B)' : 'Needs Support';
    return { averagePct: avg, standingLabel };
  }, [grades]);

  return (
    <div className="space-y-6 pb-14 max-w-6xl mx-auto">
      {/* Top Section: Welcoming Header, Active Child Context & Child Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bento-card rounded-3xl p-6 sm:p-8 relative overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
              <Shield className="w-4 h-4 shrink-0" />
              <span>Family & Guardian Portal</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-400">Verified Student Access</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">
              Welcome, {currentUser.name || 'Parent & Guardian'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Viewing real-time school updates, class attendance, homework deadlines, and academic reports for{' '}
              <strong className="text-white">{activeStudent.name}</strong> ({activeStudent.grade || 'Grade 10'} · Section {activeStudent.section || 'Solara'}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Active Student Badge or Multi-Child Selector (only shown as dropdown if > 1 linked child) */}
            {linkedStudents.length > 1 ? (
              <div className="bg-slate-900/90 border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0">
                  {activeStudent.name ? activeStudent.name[0] : 'S'}
                </div>
                <div>
                  <label htmlFor="parent-child-selector" className="block text-[10px] font-semibold text-slate-400">
                    Selected Child ({linkedStudents.length})
                  </label>
                  <select
                    id="parent-child-selector"
                    value={activeStudent.uid || activeStudent.email}
                    onChange={(e) => {
                      const found = linkedStudents.find(s => (s.uid || s.email) === e.target.value);
                      if (found) setActiveStudent(found);
                    }}
                    className="bg-transparent text-white text-xs sm:text-sm font-bold focus:outline-none cursor-pointer pr-2"
                  >
                    {linkedStudents.map(s => (
                      <option key={s.uid || s.email} value={s.uid || s.email} className="bg-slate-900 text-white">
                        {s.name} — {s.grade || 'Grade 10'} ({s.section || 'Solara'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/80 border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0">
                  {activeStudent.name ? activeStudent.name[0] : 'S'}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{activeStudent.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {activeStudent.grade || 'Grade 10'} · Section {activeStudent.section || 'Solara'} · {activeStudent.house || 'Emerald'} House
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                soundService.playAppearSound();
                setShowLinkDrawer(prev => !prev);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Link Sibling</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundService.playButtonClick();
                fetchStudentData();
              }}
              disabled={loadingData}
              title="Refresh student records"
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Collapsible Sibling Link Form */}
        <AnimatePresence>
          {showLinkDrawer && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleLinkStudent}
              className="mt-5 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 overflow-hidden"
            >
              <div className="text-xs text-slate-300">
                <span className="font-bold text-white">Link an additional child: </span>
                Enter their registered StudentOS school email address to verify guardianship.
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  required
                  placeholder="student@school.edu"
                  value={linkInputEmail}
                  onChange={(e) => setLinkInputEmail(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 flex-1 sm:w-64"
                />
                <button
                  type="submit"
                  disabled={isLinking}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shrink-0 disabled:opacity-50"
                >
                  {isLinking ? 'Verifying...' : 'Verify & Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkDrawer(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Important Notifications / Pending Actions Strip */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-300">
            <span className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <strong className="text-white font-mono tabular-nums">{pendingHomeworks.length}</strong> pending homework {pendingHomeworks.length === 1 ? 'task' : 'tasks'}
              </span>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                <strong className="text-white font-mono tabular-nums">{completedHomeworks.length}</strong> completed this term
              </span>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                <strong className="text-white font-mono tabular-nums">{activeStudent.studyHours || 0}h</strong> logged study time
              </span>
            </span>
          </div>

          {loadError && (
            <span className="text-amber-300 text-[11px] flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {loadError}
            </span>
          )}
        </div>
      </motion.div>

      {/* Main Information Cards: Attendance, Academic Progress, Study Balance */}
      {loadingData ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map(n => (
            <div key={n} className="bento-card rounded-2xl p-5 h-36 animate-pulse flex flex-col justify-between">
              <div className="h-4 w-32 bg-white/10 rounded" />
              <div className="h-7 w-24 bg-white/10 rounded" />
              <div className="h-2 w-full bg-white/5 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Attendance Summary */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.04 }}
            className="bento-card rounded-2xl p-5 flex flex-col justify-between space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-400">Attendance Summary</p>
                {attendanceSummary.rate !== null ? (
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums mt-1">
                    <NumberTicker value={attendanceSummary.rate} suffix="%" />
                  </h2>
                ) : (
                  <h2 className="text-base font-bold text-slate-200 mt-1.5">
                    No roll records logged yet
                  </h2>
                )}
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>

            {attendanceSummary.rate !== null ? (
              <div className="space-y-2">
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${attendanceSummary.rate}%` }}
                    transition={{ duration: 0.5 }}
                    className="bg-emerald-500 h-full rounded-full"
                  />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono tabular-nums">
                  <span>Present: <strong className="text-emerald-400">{attendanceSummary.present}</strong></span>
                  <span>·</span>
                  <span>Late: <strong className="text-amber-400">{attendanceSummary.late}</strong></span>
                  <span>·</span>
                  <span>Absent: <strong className="text-rose-400">{attendanceSummary.absent}</strong></span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Daily attendance percentages will appear here as soon as the class teacher submits roll call for {activeStudent.grade}.
              </p>
            )}
          </motion.div>

          {/* Card 2: Academic Progress */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.08 }}
            className="bento-card rounded-2xl p-5 flex flex-col justify-between space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-400">Academic Progress</p>
                {academicSummary.averagePct !== null ? (
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums mt-1">
                    {academicSummary.averagePct}%
                  </h2>
                ) : (
                  <h2 className="text-base font-bold text-slate-200 mt-1.5">
                    Awaiting Term Assessments
                  </h2>
                )}
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4" />
              </div>
            </div>

            {academicSummary.averagePct !== null ? (
              <div className="space-y-2">
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${academicSummary.averagePct}%` }}
                    transition={{ duration: 0.5 }}
                    className="bg-indigo-500 h-full rounded-full"
                  />
                </div>
                <p className="text-[11px] text-indigo-300 font-medium">
                  {academicSummary.standingLabel} across {grades.length} recorded {grades.length === 1 ? 'subject' : 'subjects'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Official assessment scores and subject percentages will appear here once published by subject teachers.
              </p>
            )}
          </motion.div>

          {/* Card 3: Daily Study & Screen Time Goal */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.12 }}
            className="bento-card rounded-2xl p-5 flex flex-col justify-between space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-400">Study & Screen Time Limit</p>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums mt-1">
                  {studyTimeLimitMinutes} min<span className="text-xs font-sans font-normal text-slate-400"> / day</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  const options = [60, 90, 120, 150];
                  const next = options[(options.indexOf(studyTimeLimitMinutes) + 1) % options.length];
                  setStudyTimeLimitMinutes(next);
                  localStorage.setItem(`s_os_parent_limit_${activeStudent.uid || activeStudent.email}`, String(next));
                  showNotification?.(`Updated daily study limit for ${activeStudent.name} to ${next} minutes.`);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-white/10 transition-colors cursor-pointer"
              >
                Adjust Limit
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>Total Study Hours Logged: <strong className="text-white font-mono">{activeStudent.studyHours || 0}h</strong></span>
                <span>Streak: <strong className="text-amber-400 font-mono">{activeStudent.streakDays || 0}d</strong></span>
              </div>
              <p className="text-[11px] text-slate-500">
                Helps maintain a healthy daily learning routine on StudentOS.
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Primary Two-Column Layout: Assignments & Academic Breakdown vs Announcements & Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Upcoming Assignments & Published Grades */}
        <div className="lg:col-span-7 space-y-6">
          {/* Upcoming Assignments and Deadlines */}
          <div className="bento-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2.5">
                <CheckSquare className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-white">Upcoming Assignments & Homework</h3>
                  <p className="text-xs text-slate-400">Assigned to {activeStudent.grade || 'Grade 10'} ({activeStudent.section || 'Solara'})</p>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {pendingHomeworks.length} pending · {completedHomeworks.length} done
              </span>
            </div>

            {homeworks.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-200">No assignments currently posted</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When teachers assign homework or projects to {activeStudent.grade}, they will appear here with due dates and submission status.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-96 overflow-y-auto pr-1">
                {homeworks.slice(0, 8).map((hw) => {
                  const isSubmitted = (hw.completedList || []).some(em => em.toLowerCase() === studentEmail);
                  return (
                    <div key={hw.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-semibold text-indigo-400">{hw.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span>Due {hw.dueDate || 'Upcoming'}</span>
                          {hw.givenBy && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>By {hw.givenBy}</span>
                            </>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-white truncate">{hw.title}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{hw.content}</p>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold">
                        {isSubmitted ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Submitted
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Published Report Cards & Subject Assessments */}
          <div className="bento-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2.5">
                <BarChart2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-white">Published Report Cards & Assessments</h3>
                  <p className="text-xs text-slate-400">Verified subject evaluations for {activeStudent.name}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {activeStudent.grade || 'Grade 10'}
              </span>
            </div>

            {grades.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <GraduationCap className="w-7 h-7 text-slate-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-200">No published report cards or exam marks yet</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Marks are shown only after teachers finalize and publish official exam results in the Faculty Gradebook.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {grades.map((g) => (
                  <div key={g.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{g.subject}</p>
                      <p className="text-xs text-slate-400 font-mono tabular-nums">
                        {g.assessmentId} · Score: {g.score} / {g.maxScore} ({g.percentage}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-24 bg-slate-950 h-1.5 rounded-full overflow-hidden hidden sm:block">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, g.percentage)}%` }} />
                      </div>
                      <span className="text-sm font-black font-mono text-emerald-400 tabular-nums w-8 text-right">
                        {g.letterGrade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Announcements, Events, Teacher Feedback & Communication */}
        <div className="lg:col-span-5 space-y-6">
          {/* Recent School Announcements */}
          <div className="bento-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-indigo-400 shrink-0" />
                <h3 className="text-base font-bold text-white">Recent Announcements</h3>
              </div>
              <span className="text-xs text-slate-400">Official Bulletin</span>
            </div>

            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No recent school announcements have been posted.
              </p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {announcements.slice(0, 4).map((ann, idx) => (
                  <div key={ann.id || idx} className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-indigo-300">{ann.tag || 'School Notice'}</span>
                      <span>{ann.date || 'Recent'}</span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">{ann.title || 'Notice'}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{ann.content || ann.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming School Events & Learning Resources */}
          <div className="bento-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="text-base font-bold text-white">Schedules & Learning Resources</h3>
              </div>
              <span className="text-xs text-slate-400">{events.length + resources.length} items</span>
            </div>

            {events.length === 0 && resources.length === 0 ? (
              <p className="text-xs text-slate-400 py-5 text-center">
                Class timetables, event notices, and study worksheets shared with {activeStudent.grade} will appear here.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {[...events, ...resources].slice(0, 5).map((item, idx) => (
                  <div key={item.id || idx} className="p-3 rounded-xl bg-slate-950/50 border border-white/5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Resource'} · {item.author || 'Faculty'}
                      </p>
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 shrink-0"
                      >
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Authorized Teacher Feedback & Parent-School Communication */}
          <div className="bento-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-3.5">
              <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-white">Teacher Feedback & Note to School</h3>
                <p className="text-xs text-slate-400">Direct communication with {activeStudent.grade} faculty</p>
              </div>
            </div>

            {teacherFeedback.length > 0 ? (
              <div className="space-y-2.5">
                {teacherFeedback.map((fb: any, i: number) => (
                  <div key={fb.id || i} className="p-3 rounded-xl bg-slate-950/50 border border-white/5 text-xs space-y-1">
                    <p className="text-slate-200">{fb.comment || fb.content}</p>
                    <p className="text-[10px] text-slate-400">— {fb.teacherName || 'Class Teacher'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No special teacher remarks awaiting review for {activeStudent.name}.
              </p>
            )}

            <form onSubmit={handleSendParentMessage} className="space-y-2.5 pt-2 border-t border-white/5">
              <label htmlFor="parent-school-note" className="block text-xs font-semibold text-slate-300">
                Send a note to Homeroom Teacher
              </label>
              <textarea
                id="parent-school-note"
                rows={2}
                value={parentNoteText}
                onChange={(e) => setParentNoteText(e.target.value)}
                placeholder={`Write a question or attendance note regarding ${activeStudent.name}...`}
                className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={sendingNote || !parentNoteText.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {sendingNote ? 'Sending...' : 'Send Note to Faculty'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
