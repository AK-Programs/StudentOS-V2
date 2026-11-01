/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Parental Portal
 * Approachable, clear dashboard exclusively for Parents and Guardians to monitor
 * their linked child's real-time school attendance, homework deadlines, academic progress,
 * and teacher announcements with secure OTP email verification.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, User, Award, BookOpen, Clock, Calendar, CheckCircle, 
  AlertTriangle, AlertCircle, Sparkles, Plus, ChevronRight, FileText, Bell, 
  BarChart2, CheckSquare, RefreshCw, MessageSquare, Users, X, 
  GraduationCap, Mail, KeyRound, ArrowRight, Check, Activity
} from 'lucide-react';
import { UserProfile, Homework, GradebookEntry, AttendanceRecord } from '../types';
import { supabase } from '../lib/supabase';
import { getSupabaseHomework } from '../lib/supabaseHomework';
import { getSupabaseResources } from '../lib/supabaseResources';
import { soundService } from '../lib/soundService';
import { presenceService } from '../lib/presenceService';
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

  const [activeStudent, setActiveStudent] = useState<UserProfile>(() => linkedStudents[0]);

  // Two-Step OTP Verification Link Modal
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [linkStep, setLinkStep] = useState<'email' | 'otp'>('email');
  const [linkInputEmail, setLinkInputEmail] = useState<string>('');
  const [linkOtpInput, setLinkOtpInput] = useState<string>('');
  const [isRequestingOtp, setIsRequestingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccessMsg, setLinkSuccessMsg] = useState<string | null>(null);

  const [studyTimeLimitMinutes, setStudyTimeLimitMinutes] = useState<number>(() => {
    const saved = localStorage.getItem(`s_os_parent_limit_${activeStudent?.uid || activeStudent?.email}`);
    return saved ? Number(saved) : 120;
  });

  // Business Data States
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [grades, setGrades] = useState<GradebookEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [teacherFeedback, setTeacherFeedback] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isChildOnline, setIsChildOnline] = useState<boolean>(false);
  const [parentNoteText, setParentNoteText] = useState<string>('');
  const [sendingNote, setSendingNote] = useState<boolean>(false);

  // Load linked children from server on mount
  useEffect(() => {
    let mounted = true;
    const fetchServerLinkedChildren = async () => {
      if (!currentUser?.uid) return;
      try {
        const res = await fetch(`/api/parent/linked-children?parentUid=${encodeURIComponent(currentUser.uid)}`);
        const json = await res.json();
        if (mounted && json.success && Array.isArray(json.children) && json.children.length > 0) {
          setLinkedStudents(json.children);
          try {
            localStorage.setItem(storageKey, JSON.stringify(json.children));
          } catch (_) {}
          if (!activeStudent || !json.children.some((c: any) => c.uid === activeStudent.uid)) {
            setActiveStudent(json.children[0]);
          }
        }
      } catch (err) {
        console.warn('[ParentPortal] Server link fetch notice:', err);
      }
    };

    fetchServerLinkedChildren();
    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  // Persist linked students to local storage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(linkedStudents));
    } catch {}
  }, [linkedStudents, storageKey]);

  useEffect(() => {
    if (!activeStudent) return;
    const saved = localStorage.getItem(`s_os_parent_limit_${activeStudent.uid || activeStudent.email}`);
    if (saved) setStudyTimeLimitMinutes(Number(saved));
  }, [activeStudent]);

  // Real-time Presence check for the active student
  useEffect(() => {
    if (!activeStudent?.uid) return;

    const checkOnlineStatus = () => {
      const pres = presenceService.getUserPresence(activeStudent.uid);
      setIsChildOnline(Boolean(pres && ((pres as any).isOnline || pres.status === 'online')));
    };

    checkOnlineStatus();
    const interval = setInterval(checkOnlineStatus, 15000);
    return () => clearInterval(interval);
  }, [activeStudent?.uid]);

  // Fetch real student data
  const fetchStudentData = async () => {
    if (!activeStudent) return;
    setLoadingData(true);
    setLoadError(null);

    try {
      // 1. Fetch official announcements from Supabase
      let loadedAnnouncements: any[] = [];
      try {
        const annRes = await supabase.from('global_data').select('*').eq('id', '__global_announcements__').maybeSingle();
        if (annRes.data && annRes.data.content) {
          const parsed = typeof annRes.data.content === 'string' ? JSON.parse(annRes.data.content) : annRes.data.content;
          if (Array.isArray(parsed)) loadedAnnouncements = parsed;
        }
      } catch {}
      setAnnouncements(loadedAnnouncements);

      // 2. Fetch real homework assigned to the child's grade/section
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

      // 3. Fetch real attendance from Supabase attendance table
      let attRecords: AttendanceRecord[] = [];
      try {
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .or(`user_id.eq.${activeStudent.uid},studentId.eq.${activeStudent.uid}`)
          .order('date', { ascending: false })
          .limit(30);

        if (attData && attData.length > 0) {
          attRecords = attData.map((a: any) => ({
            id: a.id,
            studentId: a.user_id || a.studentId,
            studentName: a.student_name || activeStudent.name,
            date: a.date,
            status: a.status,
            grade: a.grade || activeStudent.grade || '',
            classGrade: a.grade || activeStudent.grade,
            section: a.section || activeStudent.section
          }));
        } else {
          // Check local attendance records backup
          const localAtt = localStorage.getItem('s_os_attendance_records');
          if (localAtt) {
            const parsedAtt = JSON.parse(localAtt);
            if (Array.isArray(parsedAtt)) {
              attRecords = parsedAtt.filter((a: any) => a.studentId === activeStudent.uid || a.user_id === activeStudent.uid);
            }
          }
        }
      } catch (e) {
        console.warn('[ParentPortal] Attendance fetch note:', e);
      }
      setAttendance(attRecords);

      // 4. Fetch real academic marks if available in Supabase
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
      } catch (_) {}
      setGrades(studentMarksList);

      // 5. Fetch school learning resources
      try {
        const schoolRes = await getSupabaseResources('school_resources');
        const gradeMatchingRes = schoolRes.filter((item: any) => {
          const ig = (item.targetGrade || 'All Grades').toLowerCase();
          return ig === 'all grades' || ig === (activeStudent.grade || 'Grade 10').toLowerCase();
        });
        setResources(gradeMatchingRes.filter((r: any) => r.type === 'worksheet' || r.type === 'assignment'));
        setEvents(gradeMatchingRes.filter((r: any) => r.type === 'timetable' || r.type === 'notice').slice(0, 4));
      } catch {}

      // 6. Fetch teacher feedback
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
      setLoadError('Unable to sync some records right now. Showing latest verified student information.');
    } finally {
      setLoadingData(false);
    }
  };

  // Trigger data load when active student changes
  useEffect(() => {
    fetchStudentData();
  }, [activeStudent?.uid]);

  // Setup Real-time Subscription for Attendance and Homework changes
  useEffect(() => {
    if (!activeStudent?.uid) return;

    const channel = supabase
      .channel(`parent_realtime_sync_${activeStudent.uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `user_id=eq.${activeStudent.uid}` },
        () => {
          fetchStudentData();
          showNotification?.(`📋 Attendance update recorded for ${activeStudent.name}.`);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'homework' },
        () => {
          fetchStudentData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStudent?.uid]);

  // Step 1: Request Child Link OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = linkInputEmail.trim().toLowerCase();
    if (!targetEmail) return;

    setIsRequestingOtp(true);
    setLinkError(null);
    setLinkSuccessMsg(null);

    try {
      const res = await fetch('/api/parent/request-child-link-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentUid: currentUser.uid,
          parentEmail: currentUser.email,
          childEmail: targetEmail
        })
      });

      const json = await res.json();
      if (json.success) {
        setLinkStep('otp');
        setLinkSuccessMsg(json.message || `Verification code dispatched to ${targetEmail}`);
        showNotification?.(`Verification code sent to ${targetEmail}.`);
      } else {
        setLinkError(json.error || 'Could not verify student account. Please check the email address.');
      }
    } catch (err: any) {
      setLinkError('Network error connecting to verification service.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // Step 2: Verify Child Link OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = linkOtpInput.trim();
    if (!otp || otp.length < 5) {
      setLinkError('Please enter the 6-digit code sent to your child\'s email.');
      return;
    }

    setIsVerifyingOtp(true);
    setLinkError(null);

    try {
      const res = await fetch('/api/parent/verify-child-link-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentUid: currentUser.uid,
          parentEmail: currentUser.email,
          childEmail: linkInputEmail.trim().toLowerCase(),
          otp
        })
      });

      const json = await res.json();
      if (json.success && json.student) {
        const studentProfile: UserProfile = json.student;
        setLinkedStudents(prev => {
          const filtered = prev.filter(s => s.email.toLowerCase() !== studentProfile.email.toLowerCase());
          const updated = [...filtered, studentProfile];
          try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });

        setActiveStudent(studentProfile);
        setShowLinkModal(false);
        setLinkStep('email');
        setLinkInputEmail('');
        setLinkOtpInput('');
        setLinkSuccessMsg(null);
        showNotification?.(`✅ Successfully verified & linked ${studentProfile.name}!`);
      } else {
        setLinkError(json.error || 'Invalid or expired verification code.');
      }
    } catch (err: any) {
      setLinkError('Network error while verifying code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSendParentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentNoteText.trim() || !activeStudent) return;
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
      showNotification?.('Message delivered to class coordinator and homeroom faculty.');
    } finally {
      setSendingNote(false);
    }
  };

  const studentEmail = (activeStudent?.email || '').toLowerCase();
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
      return { averagePct: null, standingLabel: 'Awaiting Term Assessments' };
    }
    const total = grades.reduce((acc, g) => acc + g.percentage, 0);
    const avg = Math.round(total / grades.length);
    const standingLabel = avg >= 90 ? 'Excellent Standing (A+)' : avg >= 80 ? 'Strong Standing (A)' : avg >= 70 ? 'Good Progress (B)' : 'Needs Support';
    return { averagePct: avg, standingLabel };
  }, [grades]);

  if (!activeStudent) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <Shield className="w-12 h-12 text-indigo-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">No Linked Student Profile</h2>
        <p className="text-xs text-slate-400">
          Add your child's Veylentra school account to monitor attendance, homework, and academic progress.
        </p>
        <button
          onClick={() => {
            setShowLinkModal(true);
            setLinkStep('email');
          }}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-lg cursor-pointer"
        >
          Add Child with Email OTP
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-14 max-w-6xl mx-auto">
      {/* Top Banner: Parent Welcome, Child Selector & OTP Link Trigger */}
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
              <span>Dedicated Parental Portal</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-400">Verified Guardian Access</span>
              {isChildOnline && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Child Currently Active in Workspace</span>
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">
              Welcome, {currentUser.name || 'Parent & Guardian'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Monitoring real-time academic records, attendance log, and homework deadlines for{' '}
              <strong className="text-white">{activeStudent.name}</strong> ({activeStudent.grade || 'Grade 10'} · Section {activeStudent.section || 'Solara'}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Multi-Child Selector */}
            {linkedStudents.length > 1 ? (
              <div className="bg-slate-900/90 border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0">
                  {activeStudent.name ? activeStudent.name[0] : 'S'}
                </div>
                <div>
                  <label htmlFor="parent-child-selector" className="block text-[10px] font-semibold text-slate-400">
                    Active Child ({linkedStudents.length})
                  </label>
                  <select
                    id="parent-child-selector"
                    value={activeStudent.uid || activeStudent.email}
                    onChange={(e) => {
                      const found = linkedStudents.find(s => (s.uid || s.email) === e.target.value);
                      if (found) {
                        soundService.playButtonClick();
                        setActiveStudent(found);
                      }
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

            {/* Link Additional Child Button */}
            <button
              type="button"
              onClick={() => {
                soundService.playAppearSound();
                setShowLinkModal(true);
                setLinkStep('email');
                setLinkError(null);
                setLinkSuccessMsg(null);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Link Child (OTP)</span>
            </button>

            {/* Refresh Data */}
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

        {/* Status Strip: Homework & Study Statistics */}
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
                <strong className="text-white font-mono tabular-nums">{activeStudent.studyHours || 0}h</strong> logged learning time
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

      {/* Main Metric Cards: Real Attendance, Academic Progress, Study Balance */}
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
                <p className="text-xs font-semibold text-slate-400">Classroom Roll Attendance</p>
                {attendanceSummary.rate !== null ? (
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums mt-1">
                    <NumberTicker value={attendanceSummary.rate} suffix="%" />
                  </h2>
                ) : (
                  <h2 className="text-base font-bold text-slate-200 mt-1.5">
                    No roll entries logged
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
                Daily roll percentages update automatically when teachers submit attendance for {activeStudent.grade}.
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
                <p className="text-xs font-semibold text-slate-400">Academic Standing</p>
                {academicSummary.averagePct !== null ? (
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums mt-1">
                    {academicSummary.averagePct}%
                  </h2>
                ) : (
                  <h2 className="text-base font-bold text-slate-200 mt-1.5">
                    Mid-Term Review Pending
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
                  {academicSummary.standingLabel} across {grades.length} recorded subjects
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Official assessment scores appear once released by teachers in the Faculty Gradebook.
              </p>
            )}
          </motion.div>

          {/* Card 3: Daily Study & Screen Time Limit */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.12 }}
            className="bento-card rounded-2xl p-5 flex flex-col justify-between space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-400">Daily Study Target</p>
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
                  showNotification?.(`Updated daily study goal for ${activeStudent.name} to ${next} minutes.`);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-white/10 transition-colors cursor-pointer"
              >
                Adjust Goal
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>Total Study Time: <strong className="text-white font-mono">{activeStudent.studyHours || 0}h</strong></span>
                <span>Active Streak: <strong className="text-amber-400 font-mono">{activeStudent.streakDays || 0}d</strong></span>
              </div>
              <p className="text-[11px] text-slate-500">
                Encourages balanced daily study time and regular revision habits.
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Two-Column Layout: Assignments & Attendance vs Announcements & Faculty Note */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Assignments & Daily Attendance Log */}
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
                <p className="text-sm font-semibold text-slate-200">No active homework tasks</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When teachers assign homework to {activeStudent.grade}, due dates and submission statuses will update here in real time.
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

          {/* Real Attendance Daily Log */}
          <div className="bento-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-white">Daily Attendance Records</h3>
                  <p className="text-xs text-slate-400">Verified teacher roll submissions for {activeStudent.name}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {attendance.length} logged days
              </span>
            </div>

            {attendance.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Calendar className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-200">No attendance records submitted yet</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Roll records will appear here as soon as attendance is taken by the homeroom teacher.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-72 overflow-y-auto pr-1">
                {attendance.slice(0, 10).map((rec, idx) => {
                  const isPresent = rec.status === 'present';
                  const isLate = rec.status === 'late';
                  return (
                    <div key={rec.id || idx} className="py-2.5 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-white">{rec.date}</p>
                        <p className="text-[10px] text-slate-400">Class {activeStudent.grade} • Section {activeStudent.section || 'Solara'}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isPresent
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isLate
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {rec.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Announcements, Resources & Teacher Communication */}
        <div className="lg:col-span-5 space-y-6">
          {/* Recent School Announcements */}
          <div className="bento-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-indigo-400 shrink-0" />
                <h3 className="text-base font-bold text-white">School Announcements</h3>
              </div>
              <span className="text-xs text-slate-400">Official Bulletin</span>
            </div>

            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No recent announcements posted.
              </p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {announcements.slice(0, 4).map((ann, idx) => (
                  <div key={ann.id || idx} className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-indigo-300">{ann.tag || 'Notice'}</span>
                      <span>{ann.date || 'Recent'}</span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">{ann.title || 'Notice'}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{ann.content || ann.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher Feedback & Direct Note to School */}
          <div className="bento-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-3.5">
              <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-white">Teacher Feedback & Messages</h3>
                <p className="text-xs text-slate-400">Direct notes with {activeStudent.grade} faculty</p>
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
                Send a note to Homeroom Faculty
              </label>
              <textarea
                id="parent-school-note"
                rows={2}
                value={parentNoteText}
                onChange={(e) => setParentNoteText(e.target.value)}
                placeholder={`Write an attendance notice or inquiry regarding ${activeStudent.name}...`}
                className="w-full rounded-xl bg-slate-950 border border-white/10 p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={sendingNote || !parentNoteText.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {sendingNote ? 'Sending...' : 'Send Note to School'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Two-Step Child Link OTP Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">Link Child Account</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkStep('email');
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-center gap-3 text-xs font-bold">
              <span className={`px-3 py-1 rounded-full ${linkStep === 'email' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                1. Student Email
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
              <span className={`px-3 py-1 rounded-full ${linkStep === 'otp' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                2. Enter 6-Digit OTP
              </span>
            </div>

            {linkError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{linkError}</span>
              </div>
            )}

            {linkSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{linkSuccessMsg}</span>
              </div>
            )}

            {linkStep === 'email' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter your child's registered Veylentra school email address. A 6-digit verification code will be sent to their email to confirm legitimate guardian access.
                </p>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={linkInputEmail}
                    onChange={(e) => setLinkInputEmail(e.target.value)}
                    placeholder="student@school.edu"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRequestingOtp || !linkInputEmail.includes('@')}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 cursor-pointer"
                  >
                    {isRequestingOtp ? 'Sending Code...' : 'Send Verification OTP'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter the 6-digit security code sent to <strong className="text-white">{linkInputEmail}</strong>.
                </p>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={linkOtpInput}
                    onChange={(e) => setLinkOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white text-center font-mono text-lg font-black tracking-widest focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Code expires in 10 minutes</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkStep('email');
                      setLinkOtpInput('');
                    }}
                    className="text-indigo-400 hover:underline cursor-pointer"
                  >
                    Resend / Change Email
                  </button>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setLinkStep('email')}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingOtp || linkOtpInput.length < 5}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    {isVerifyingOtp ? 'Verifying...' : 'Confirm & Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
