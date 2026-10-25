/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Official School Timetables for All Campus Roles
 * Role-aware timetable view & administration with conflict detection,
 * teacher allocation, room assignments, and official schedule publication.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Plus,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Coffee,
  RefreshCw,
  Eye,
  Lock
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import {
  OfficialClassTimetable,
  DayTimetable,
  TimetablePeriod
} from '../types/syllabusTimetable';
import { SyllabusTimetableService } from '../lib/syllabusTimetableService';
import { soundService } from '../lib/soundService';

interface OfficialTimetableViewerProps {
  currentUser: UserProfile;
  effectiveRole: UserRole;
  showNotification?: (msg: string) => void;
  goBack?: () => void;
}

export const OfficialTimetableViewer: React.FC<OfficialTimetableViewerProps> = ({
  currentUser,
  effectiveRole,
  showNotification,
  goBack
}) => {
  const schoolId = 'default_school';
  const userGrade = currentUser?.grade || 'Grade 10';
  const userName = currentUser?.name || 'Staff';

  const isStudent = effectiveRole === 'student';
  const isTeacher = effectiveRole === 'teacher';
  const isCoordinator = effectiveRole === 'coordinator';
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin';
  const canEdit = isAdmin || isCoordinator;

  const [timetable, setTimetable] = useState<OfficialClassTimetable | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<DayTimetable['day']>('Monday');
  const [selectedGrade, setSelectedGrade] = useState<string>(userGrade);

  // Edit / Conflict detection state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [tempSchedule, setTempSchedule] = useState<DayTimetable[]>([]);
  const [conflictReport, setConflictReport] = useState<{
    hasConflict: boolean;
    conflicts: Array<{ day: string; period: number; type: 'teacher' | 'room'; details: string }>;
  }>({ hasConflict: false, conflicts: [] });

  const [showMyScheduleOnly, setShowMyScheduleOnly] = useState<boolean>(false);

  const [showAddModal, setShowAddPeriodModal] = useState(false);
  const [allTeachers, setAllTeachers] = useState<string[]>([]);
  const [newPeriodData, setNewPeriodData] = useState<Partial<TimetablePeriod>>({
    periodNumber: 1,
    subject: 'Mathematics',
    teacherName: '',
    room: 'Room 101',
    startTime: '08:30',
    endTime: '09:20'
  });

  const daysList: DayTimetable['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  useEffect(() => {
    async function fetchTeachers() {
      try {
        const { data } = await SyllabusTimetableService.getOfficialSyllabuses(schoolId, selectedGrade); // Just to warm up
        const { data: users } = await supabase.from('user_profiles').select('name').in('role', ['teacher', 'coordinator', 'admin', 'super_admin']);
        if (users) setAllTeachers(users.map(u => u.name).filter(Boolean));
      } catch (e) {}
    }
    fetchTeachers();
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadTimetable() {
      setLoading(true);
      try {
        const tt = await SyllabusTimetableService.getOfficialTimetable(schoolId, selectedGrade);
        if (isMounted) {
          setTimetable(tt);
          setTempSchedule(tt.schedule);
          const validation = SyllabusTimetableService.validateTimetableConflicts(tt.schedule);
          setConflictReport(validation);
        }
      } catch (err) {
        console.warn('[Timetable] Load error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadTimetable();
    return () => {
      isMounted = false;
    };
  }, [schoolId, selectedGrade]);

  const activeDaySchedule = (isEditing ? tempSchedule : timetable?.schedule || []).find(
    s => s.day === selectedDay
  );

  const handleAddPeriod = () => {
    if (!newPeriodData.subject || !newPeriodData.teacherName) {
      showNotification?.('Please fill in subject and teacher name.');
      return;
    }

    const updatedSchedule = tempSchedule.map(daySch => {
      if (daySchedule.day === selectedDay) {
        return {
          ...daySch,
          periods: [...daySch.periods, { ...newPeriodData, name: `Period ${newPeriodData.periodNumber}` } as TimetablePeriod].sort((a, b) => a.periodNumber - b.periodNumber)
        };
      }
      return daySch;
    });

    // If day doesn't exist in schedule yet
    if (!updatedSchedule.find(s => s.day === selectedDay)) {
       updatedSchedule.push({
         day: selectedDay,
         periods: [{ ...newPeriodData, name: `Period ${newPeriodData.periodNumber}` } as TimetablePeriod]
       });
    }

    setTempSchedule(updatedSchedule);
    setShowAddPeriodModal(false);
    
    const validation = SyllabusTimetableService.validateTimetableConflicts(updatedSchedule);
    setConflictReport(validation);
    if (validation.hasConflict) {
      showNotification?.('⚠️ Conflict detected with the new period!');
    }
  };

  // Save changes
  const handleSaveTimetable = async () => {
    soundService.playButtonClick();
    if (!timetable) return;

    const validation = SyllabusTimetableService.validateTimetableConflicts(tempSchedule);
    setConflictReport(validation);

    if (validation.hasConflict) {
      if (showNotification) {
        showNotification('⚠️ Warning: Conflicting teacher or room allocations detected!');
      }
    }

    const updated: OfficialClassTimetable = {
      ...timetable,
      schedule: tempSchedule,
      version: timetable.version + 1,
      publishedBy: `${userName} (${effectiveRole})`,
      publishedAt: new Date().toISOString(),
      changeHistory: [
        {
          date: new Date().toISOString().split('T')[0],
          changedBy: userName,
          summary: `Updated timetable schedule for ${selectedGrade}`
        },
        ...(timetable.changeHistory || [])
      ]
    };

    const ok = await SyllabusTimetableService.saveOfficialTimetable(schoolId, selectedGrade, updated);
    if (ok) {
      setTimetable(updated);
      setIsEditing(false);
      soundService.playLevelUp();
      if (showNotification) {
        showNotification('✓ Official school timetable published successfully!');
      }
    } else {
      if (showNotification) {
        showNotification('Failed to save official timetable.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {goBack && (
            <button
              type="button"
              onClick={goBack}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black font-display text-white">
                Official School Timetable
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> School Managed
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isStudent && 'Your authorized class schedule. Official school hours are distinguished from personal study sessions.'}
              {isTeacher && 'Your assigned periods, subjects, laboratories, and authorized substitutions.'}
              {isCoordinator && 'Class and teacher period allocations with real-time room conflict detection.'}
              {isAdmin && 'Official curriculum scheduling, teacher assignment matrix, and conflict validation.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Grade Selector (for Staff) */}
          {!isStudent && (
            <div className="flex items-center gap-2">
              {isTeacher && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMyScheduleOnly(!showMyScheduleOnly);
                    soundService.playButtonClick();
                  }}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    showMyScheduleOnly 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20' 
                      : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {showMyScheduleOnly ? 'Showing My Periods' : 'Show All Periods'}
                </button>
              )}
              <select
                value={selectedGrade}
                onChange={e => {
                  setSelectedGrade(e.target.value);
                  soundService.playButtonClick();
                }}
                className="text-xs px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-bold"
              >
                <option value="Grade 10">Grade 10 Section A</option>
                <option value="Grade 11">Grade 11 Science</option>
                <option value="Grade 12">Grade 12 Advanced</option>
                <option value="Grade 9">Grade 9 Foundational</option>
              </select>
            </div>
          )}

          {canEdit && (
            <div className="flex gap-2">
              {isEditing ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPeriodModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Period</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setTempSchedule(timetable?.schedule || []);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTimetable}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Publish Schedule</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    soundService.playButtonClick();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Schedule</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Period Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-black text-white">Add New Period to {selectedDay}</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Period Number</label>
                  <input 
                    type="number" 
                    value={newPeriodData.periodNumber} 
                    onChange={e => setNewPeriodData({...newPeriodData, periodNumber: parseInt(e.target.value)})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Subject</label>
                  <input 
                    type="text" 
                    value={newPeriodData.subject} 
                    onChange={e => setNewPeriodData({...newPeriodData, subject: e.target.value})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Assigned Teacher</label>
                <select 
                  value={newPeriodData.teacherName} 
                  onChange={e => setNewPeriodData({...newPeriodData, teacherName: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">Select Teacher</option>
                  {allTeachers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Room / Lab</label>
                <input 
                  type="text" 
                  value={newPeriodData.room} 
                  onChange={e => setNewPeriodData({...newPeriodData, room: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Start Time</label>
                  <input 
                    type="time" 
                    value={newPeriodData.startTime} 
                    onChange={e => setNewPeriodData({...newPeriodData, startTime: e.target.value})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">End Time</label>
                  <input 
                    type="time" 
                    value={newPeriodData.endTime} 
                    onChange={e => setNewPeriodData({...newPeriodData, endTime: e.target.value})}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setShowAddPeriodModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddPeriod}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Add Period
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Conflict Alert Banner (If Any Detected) */}
      {conflictReport.hasConflict && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold">Schedule Conflict Warning ({conflictReport.conflicts.length} Issues)</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-200/90">
              {conflictReport.conflicts.map((c, i) => (
                <li key={i}>{c.details}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Days Tabs Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {daysList.map(day => (
          <button
            key={day}
            type="button"
            onClick={() => {
              setSelectedDay(day);
              soundService.playButtonClick();
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 ${
              selectedDay === day
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-900/80 hover:bg-slate-800 border border-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Periods Grid / Matrix */}
      <div className="space-y-3">
        {activeDaySchedule?.periods
          .filter(p => {
            if (isTeacher && showMyScheduleOnly) {
              if (p.isBreak) return false;
              return p.teacherName?.toLowerCase().includes(userName.toLowerCase());
            }
            return true;
          })
          .map((period, idx) => {
            const isBreak = period.isBreak;
            const isMyTeachingPeriod =
              isTeacher &&
              period.teacherName?.toLowerCase().includes(userName.toLowerCase());

          return (
            <motion.div
              key={idx}
              layout
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                isBreak
                  ? 'bg-slate-950/40 border-white/5 opacity-80'
                  : isMyTeachingPeriod
                  ? 'bg-indigo-950/70 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                  : 'bg-slate-950/80 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left: Period Name & Time */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-black text-xs shrink-0 ${
                      isBreak
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    }`}
                  >
                    {isBreak ? (
                      <Coffee className="w-5 h-5 text-amber-400" />
                    ) : (
                      <>
                        <span className="text-[9px] uppercase text-slate-400 font-bold">P</span>
                        <span>{period.periodNumber}</span>
                      </>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-extrabold text-white">
                        {isBreak ? period.name : period.subject}
                      </h4>
                      {isMyTeachingPeriod && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase">
                          Your Class
                        </span>
                      )}
                      {period.substitutionTeacherName && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-extrabold uppercase">
                          Substitution
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        {period.startTime} – {period.endTime}
                      </span>
                      {period.room && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {period.room}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Assigned Teacher & Room Details */}
                {!isBreak && (
                  <div className="flex items-center gap-4 text-xs">
                    {period.teacherName && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/5 text-slate-300">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-semibold">{period.teacherName}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Meta Footer */}
      {timetable && (
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Published by: <strong className="text-slate-400">{timetable.publishedBy}</strong> on{' '}
            {new Date(timetable.publishedAt).toLocaleDateString()}
          </span>
          <span className="font-mono">
            Version {timetable.version} · Academic Year {timetable.academicYear}
          </span>
        </div>
      )}
    </div>
  );
};
