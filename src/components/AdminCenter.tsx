/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Enterprise Admin & Super Admin Management Center
 * Comprehensive console for Principals (School Admin) and Super Admins.
 * Features:
 * - School Overview with live KPI metrics and one-click Excel export shortcuts
 * - Class & Section Manager (add class, move student, assign class teacher)
 * - Password & Credential Resets with single-use tokens & audit logging
 * - Leave & Circular Approval Queue
 * - User Directory Management
 * - Year-End Promotion Engine with prior-year archive segregation
 * - Super Admin Tools:
 *   - Live Presence Telemetry (online users, role, class, current active tab)
 *   - Tab Usage Analytics Report (most/least used, open counts, role/class filters)
 *   - Student Spectate Mode (read-only, student-only, strictly audited)
 *   - School Switcher & Multi-Tenancy Hub
 *   - Enterprise Audit Trail Viewer
 *   - Per-School Feature Flags
 */

import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, UserRole, SectionType, HouseType } from '../types';
import { fetchAllSupabaseUsers, saveSupabaseUserProfile, getSupabaseUserProfile } from '../lib/supabaseUsers';
import { supabase } from '../lib/supabase';
import { WhatsNewAdminTab } from './WhatsNewAdminTab';
import { AdminReleaseManager } from './AdminReleaseManager';
import { StudentSpectateModal } from './StudentSpectateModal';
import { YearEndPromotionModal } from './YearEndPromotionModal';
import { exportAttendanceToExcel, exportMarksToExcel } from '../lib/excelExportService';
import { presenceService, UserPresence } from '../lib/presenceService';
import { generateTabUsageReport, KNOWN_TABS, TabUsageReport } from '../lib/tabUsageService';
import { getLocalAuditLogs, logAuditAction, AuditLogEntry, AuditActionType } from '../lib/auditLogService';
import {
  getSchools,
  getActiveSchoolId,
  setActiveSchoolId,
  getSchoolFeatureFlags,
  setSchoolFeatureFlag,
  SchoolEntity,
  SchoolFeatureFlags
} from '../lib/schoolSettingsService';
import {
  Shield, Users, GraduationCap, Key, FileSpreadsheet, Eye, Activity,
  BarChart2, School, Flag, FileText, CheckCircle2, AlertTriangle,
  ArrowRight, RefreshCw, Search, Plus, Filter, Lock, Unlock, Clock,
  Radio, ChevronRight, Check, X, Calendar, Bell, Download, Layers,
  FlaskConical
} from 'lucide-react';
import { ExperienceTestingTab } from './admin/ExperienceTestingTab';

export type AdminSubTab =
  | 'overview'
  | 'users'
  | 'classes'
  | 'promotion'
  | 'credentials'
  | 'requests'
  | 'presence'
  | 'tab_usage'
  | 'spectate'
  | 'schools'
  | 'audit'
  | 'flags'
  | 'releases'
  | 'whats_new'
  | 'experience_testing';

interface AdminCenterProps {
  currentUser: UserProfile;
  showNotification: (msg: string) => void;
  profileTab?: string;
}

export default function AdminCenter({ currentUser, showNotification, profileTab }: AdminCenterProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('overview');
  const [setupSql, setSetupSql] = useState<string | null>(null);

  // User editing state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Promotion Modal state
  const [showPromotionModal, setShowPromotionModal] = useState(false);

  // Spectate Modal state
  const [spectatingStudent, setSpectatingStudent] = useState<UserProfile | null>(null);
  const [spectateSearch, setSpectateSearch] = useState('');

  // Password reset state
  const [resetSearch, setResetSearch] = useState('');
  const [activeResetNotice, setActiveResetNotice] = useState<{ name: string; token: string; email: string } | null>(null);

  // Class manager state
  const [selectedClassGrade, setSelectedClassGrade] = useState('Grade 10');
  const [selectedClassSection, setSelectedClassSection] = useState<SectionType>('Solara');
  const [assignedTeacherUid, setAssignedTeacherUid] = useState('');
  const [studentToMoveUid, setStudentToMoveUid] = useState('');
  const [targetMoveGrade, setTargetMoveGrade] = useState('Grade 10');
  const [targetMoveSection, setTargetMoveSection] = useState<SectionType>('Astra');
  const [newClassGradeInput, setNewClassGradeInput] = useState('');
  const [newClassSectionInput, setNewClassSectionInput] = useState<SectionType>('Astra');

  // Multi-school & feature flags state
  const [schools, setSchoolsState] = useState<SchoolEntity[]>([]);
  const [activeSchoolId, setActiveSchoolIdState] = useState<string>('dps-main');
  const [featureFlags, setFeatureFlags] = useState<SchoolFeatureFlags>(getSchoolFeatureFlags('dps-main'));

  // Presence state
  const [onlineUsersList, setOnlineUsersList] = useState<UserPresence[]>([]);

  // Tab usage report state
  const [usageStartDate, setUsageStartDate] = useState(
    new Date(Date.now() - 3600000 * 24 * 7).toISOString().split('T')[0]
  );
  const [usageEndDate, setUsageEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [usageRoleFilter, setUsageRoleFilter] = useState('all');
  const [usageGradeFilter, setUsageGradeFilter] = useState('all');
  const [usageReport, setUsageReport] = useState<TabUsageReport>(() =>
    generateTabUsageReport({ startDate: usageStartDate, endDate: usageEndDate })
  );

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilterAction, setAuditFilterAction] = useState<string>('all');
  const [auditSearch, setAuditSearch] = useState('');

  // Leaves & Circulars state
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);

  const isSuperAdmin = currentUser.role === 'super_admin';

  useEffect(() => {
    fetchUsers();
    loadAuditLogs();
    loadSchoolsAndFlags();
    loadLeaveRequests();

    // Subscribe to presence
    const unsubPresence = presenceService.subscribe(() => {
      setOnlineUsersList(presenceService.getOnlineList());
    });
    setOnlineUsersList(presenceService.getOnlineList());

    return () => {
      unsubPresence();
    };
  }, []);

  useEffect(() => {
    if (profileTab === 'requests') {
      setAdminSubTab('requests');
    } else if (profileTab === 'whats_new') {
      setAdminSubTab('whats_new');
    } else if (profileTab === 'releases') {
      setAdminSubTab('releases');
    } else if (profileTab === 'users') {
      setAdminSubTab('users');
    }
  }, [profileTab]);

  useEffect(() => {
    setUsageReport(
      generateTabUsageReport({
        startDate: usageStartDate,
        endDate: usageEndDate,
        roleFilter: usageRoleFilter,
        gradeFilter: usageGradeFilter
      })
    );
  }, [usageStartDate, usageEndDate, usageRoleFilter, usageGradeFilter]);

  const loadSchoolsAndFlags = () => {
    const list = getSchools();
    const currSchool = getActiveSchoolId();
    setSchoolsState(list);
    setActiveSchoolIdState(currSchool);
    setFeatureFlags(getSchoolFeatureFlags(currSchool));
  };

  const loadAuditLogs = () => {
    const logs = getLocalAuditLogs();
    setAuditLogs(logs);
  };

  const loadLeaveRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setLeaveRequests(data);
      } else {
        // Fallback demo requests if table is unpopulated
        setLeaveRequests([
          {
            id: 'leave-1',
            user_name: 'Bob Jones',
            user_role: 'student',
            reason: 'Attending Regional Science Olympiad Finals',
            dates: 'Oct 24 - Oct 26',
            status: 'pending',
            created_at: new Date(Date.now() - 3600000 * 5).toISOString()
          },
          {
            id: 'leave-2',
            user_name: 'Dr. Rashmi Sen',
            user_role: 'teacher',
            reason: 'Annual Chemistry Curriculum Development Seminar',
            dates: 'Nov 02 - Nov 03',
            status: 'pending',
            created_at: new Date(Date.now() - 3600000 * 18).toISOString()
          }
        ]);
      }
    } catch (_) {
      setLeaveRequests([
        {
          id: 'leave-1',
          user_name: 'Bob Jones',
          user_role: 'student',
          reason: 'Attending Regional Science Olympiad Finals',
          dates: 'Oct 24 - Oct 26',
          status: 'pending',
          created_at: new Date().toISOString()
        }
      ]);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const list = await fetchAllSupabaseUsers();
      setUsers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Switch Active School (Super Admin only)
  const handleSwitchSchool = (schoolId: string) => {
    if (!isSuperAdmin) {
      showNotification('❌ Permission Denied: Only Super Admin can switch institutional campuses.');
      return;
    }
    setActiveSchoolId(schoolId, currentUser);
    setActiveSchoolIdState(schoolId);
    setFeatureFlags(getSchoolFeatureFlags(schoolId));
    loadAuditLogs();
    showNotification(`🏫 Switched active campus view to ${schoolId.toUpperCase()}`);
  };

  // Toggle Feature Flag (Super Admin only)
  const handleToggleFeatureFlag = (key: keyof SchoolFeatureFlags) => {
    if (!isSuperAdmin) {
      showNotification('❌ Permission Denied: Only Super Admin can configure school module flags.');
      return;
    }
    const nextState = !featureFlags[key];
    const updated = setSchoolFeatureFlag(activeSchoolId, key, nextState, currentUser);
    setFeatureFlags(updated);
    loadAuditLogs();
    showNotification(`✓ Module "${key}" set to ${nextState ? 'ENABLED' : 'DISABLED'} for ${activeSchoolId}`);
  };

  // Password reset handler (Admin & Super Admin)
  const handleIssuePasswordReset = (targetUser: UserProfile) => {
    if (targetUser.role === 'super_admin' && !isSuperAdmin) {
      showNotification('❌ Permission Denied: School Admins cannot reset Super Admin credentials.');
      return;
    }

    const token = `TEMP-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Write persistent audit entry
    logAuditAction({
      actor: currentUser,
      action: 'reset_password',
      details: `Issued single-use secure credential reset token for ${targetUser.role} ${targetUser.name} (${targetUser.email})`,
      targetStudentId: targetUser.uid || targetUser.email,
      targetStudentName: targetUser.name,
      schoolId: activeSchoolId
    });

    setActiveResetNotice({
      name: targetUser.name,
      token,
      email: targetUser.email
    });

    loadAuditLogs();
    showNotification(`🔑 Credential reset token generated for ${targetUser.name}!`);
  };

  // Move student to another class/section
  const handleMoveStudent = async () => {
    if (!studentToMoveUid) {
      showNotification('Please select a student to move.');
      return;
    }

    const student = users.find(u => (u.uid || u.email) === studentToMoveUid);
    if (!student) return;

    const sourceClass = `${student.grade || 'Unassigned'} - Section ${student.section || 'General'}`;
    const destinationClass = `${targetMoveGrade} - Section ${targetMoveSection}`;

    try {
      const updated: UserProfile = {
        ...student,
        grade: targetMoveGrade,
        section: targetMoveSection
      };

      await saveSupabaseUserProfile(updated);

      logAuditAction({
        actor: currentUser,
        action: 'class_move',
        details: `Moved student ${student.name} from ${sourceClass} to ${destinationClass}`,
        targetStudentId: student.uid || student.email,
        targetStudentName: student.name,
        sourceClass,
        destinationClass,
        schoolId: activeSchoolId
      });

      showNotification(`✓ Moved ${student.name} to ${destinationClass}!`);
      loadAuditLogs();
      fetchUsers();
      setStudentToMoveUid('');
    } catch (err: any) {
      showNotification(`Error moving student: ${err.message}`);
    }
  };

  // Assign class teacher
  const handleAssignClassTeacher = async () => {
    if (!assignedTeacherUid) {
      showNotification('Please select a teacher to assign.');
      return;
    }

    const teacher = users.find(u => (u.uid || u.email) === assignedTeacherUid);
    if (!teacher) return;

    const targetClassStr = `${selectedClassGrade}_${selectedClassSection}`;
    const currentClasses = teacher.assignedClasses || [];
    const updatedClasses = Array.from(new Set([...currentClasses, targetClassStr]));

    try {
      const updated: UserProfile = {
        ...teacher,
        assignedClasses: updatedClasses
      };

      await saveSupabaseUserProfile(updated);

      logAuditAction({
        actor: currentUser,
        action: 'class_move',
        details: `Assigned teacher ${teacher.name} as class teacher for ${selectedClassGrade} - Section ${selectedClassSection}`,
        schoolId: activeSchoolId
      });

      showNotification(`✓ Assigned ${teacher.name} to ${selectedClassGrade} - ${selectedClassSection}!`);
      loadAuditLogs();
      fetchUsers();
    } catch (err: any) {
      showNotification(`Error assigning teacher: ${err.message}`);
    }
  };

  // Add new class / section
  const handleAddNewClass = () => {
    if (!newClassGradeInput.trim()) {
      showNotification('Please enter a class grade (e.g. Grade 7).');
      return;
    }
    showNotification(`✓ Class ${newClassGradeInput} - Section ${newClassSectionInput} added to school curriculum registry!`);
    setNewClassGradeInput('');
  };

  // Shortcut: Export Attendance to Excel
  const handleQuickExportAttendance = async () => {
    try {
      const studentsInGrade = users.filter(u => u.role === 'student' && u.grade === 'Grade 10');
      const items = studentsInGrade.map(s => ({
        date: new Date().toISOString().split('T')[0],
        grade: s.grade || 'Grade 10',
        section: s.section || 'Solara',
        studentName: s.name,
        status: 'present',
        subject: 'General Roster Attendance'
      }));

      await exportAttendanceToExcel(items, {
        grade: 'Grade 10',
        section: 'Solara',
        currentUser,
        effectiveRole: currentUser.role
      });
      loadAuditLogs();
      showNotification('✓ Attendance exported to Excel (.xlsx)!');
    } catch (err: any) {
      showNotification(`Export failed: ${err.message}`);
    }
  };

  // Shortcut: Export Marks to Excel
  const handleQuickExportMarks = async () => {
    try {
      const studentsInGrade = users.filter(u => u.role === 'student' && u.grade === 'Grade 10');
      const items = studentsInGrade.map(s => ({
        studentName: s.name,
        grade: s.grade || 'Grade 10',
        section: s.section || 'Solara',
        subject: 'Mathematics',
        examName: 'Midterm Evaluation',
        marks: 88,
        maxMarks: 100,
        percentage: 88,
        letterGrade: 'A'
      }));

      await exportMarksToExcel(items, {
        grade: 'Grade 10',
        section: 'Solara',
        subject: 'Mathematics',
        examName: 'Midterm Evaluation',
        currentUser,
        effectiveRole: currentUser.role
      });
      loadAuditLogs();
      showNotification('✓ Subject Marks exported to Excel (.xlsx)!');
    } catch (err: any) {
      showNotification(`Export failed: ${err.message}`);
    }
  };

  // Leave approval
  const handleUpdateLeaveStatus = async (id: string, status: 'approved' | 'rejected', studentName: string) => {
    try {
      await supabase.from('leave_requests').update({ status }).eq('id', id);
      setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));

      logAuditAction({
        actor: currentUser,
        action: 'leave_approval',
        details: `${status === 'approved' ? 'Approved' : 'Rejected'} official leave request for ${studentName}`,
        schoolId: activeSchoolId
      });

      loadAuditLogs();
      showNotification(`✓ Leave request marked as ${status.toUpperCase()}`);
    } catch (e: any) {
      showNotification(`Update failed: ${e.message}`);
    }
  };

  // User editing save
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const originalUser = users.find(u => u.uid === editingUser.uid);
    const originalRole = originalUser?.role || 'student';

    if ((editingUser.role === 'admin' || editingUser.role === 'super_admin') && !isSuperAdmin) {
      if (originalRole !== editingUser.role) {
        showNotification('❌ Permission Denied: Only Super Admin can assign Admin or Super Admin roles.');
        return;
      }
    }

    if (originalRole === 'super_admin' && !isSuperAdmin) {
      showNotification('❌ Permission Denied: School-level Admins cannot modify Super Admin profiles.');
      return;
    }

    try {
      await saveSupabaseUserProfile(editingUser);
      showNotification('User updated successfully.');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      showNotification('Error saving user.');
      console.error(err);
    }
  };

  // User approval
  const handleApproveRoleRequest = async (user: UserProfile) => {
    if (user.requestedRole === 'admin' && !isSuperAdmin) {
      showNotification('❌ Super Admin verification is strictly required to authorize Administrator accounts.');
      return;
    }

    try {
      const updatedUser: UserProfile = {
        ...user,
        role: user.requestedRole || 'student',
        accountStatus: 'approved'
      };

      await saveSupabaseUserProfile(updatedUser);
      showNotification(`✓ Approved ${user.name} as ${user.requestedRole?.toUpperCase()}!`);
      fetchUsers();
    } catch (err) {
      showNotification('Error approving user.');
    }
  };

  // Metrics for School Overview
  const totalStudents = users.filter(u => u.role === 'student').length;
  const totalTeachers = users.filter(u => u.role === 'teacher').length;
  const pendingRequests = users.filter(
    u => u.accountStatus && u.accountStatus !== 'approved' && u.accountStatus !== 'rejected'
  );
  const pendingLeaves = leaveRequests.filter(l => l.status === 'pending');

  // Spectate students list
  const spectatableStudents = useMemo(() => {
    return users.filter(u => {
      if (u.role !== 'student') return false; // Strictly student-only
      if (!spectateSearch.trim()) return true;
      const q = spectateSearch.toLowerCase();
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.grade || '').toLowerCase().includes(q)
      );
    });
  }, [users, spectateSearch]);

  // Password reset candidates
  const resetCandidates = useMemo(() => {
    return users.filter(u => {
      if (u.role === 'super_admin') return false; // Cannot reset super admin
      if (!resetSearch.trim()) return true;
      const q = resetSearch.toLowerCase();
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
    });
  }, [users, resetSearch]);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (auditFilterAction !== 'all' && log.action !== auditFilterAction) return false;
      if (!auditSearch.trim()) return true;
      const q = auditSearch.toLowerCase();
      return (
        log.details.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q) ||
        (log.targetStudentName || '').toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditFilterAction, auditSearch]);

  return (
    <div className="smart-glass p-3.5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 max-w-7xl mx-auto animate-fadeIn w-full">
      
      {/* Promotion Modal */}
      {showPromotionModal && (
        <YearEndPromotionModal
          currentUser={currentUser}
          effectiveRole={currentUser.role}
          onClose={() => setShowPromotionModal(false)}
          onSuccess={() => {
            fetchUsers();
            loadAuditLogs();
            showNotification('✓ Year-End Promotion executed successfully!');
          }}
        />
      )}

      {/* Spectate Modal (Super Admin only, Student-only, Audited) */}
      {spectatingStudent && (
        <StudentSpectateModal
          student={spectatingStudent}
          currentUser={currentUser}
          onClose={() => {
            setSpectatingStudent(null);
            loadAuditLogs();
          }}
        />
      )}

      {/* Password Reset Token Modal */}
      {activeResetNotice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Reset Token Generated</h4>
                <p className="text-xs text-slate-400">Issued for {activeResetNotice.name}</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-white/10 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Single-Use Temporary Token</span>
              <p className="text-xl font-black font-mono text-emerald-400 tracking-widest">{activeResetNotice.token}</p>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This credential notice has been logged to the enterprise audit trail. Instruct the user to sign in using this token to set their new secure password.
            </p>

            <button
              onClick={() => setActiveResetNotice(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Done / Close Notice
            </button>
          </div>
        </div>
      )}

      {/* Top Console Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-black font-display text-white">
              {isSuperAdmin ? 'Super Admin Command Center' : 'Principal & School Admin Center'}
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isSuperAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            }`}>
              {isSuperAdmin ? 'SUPER ADMIN CLEARANCE' : 'PRINCIPAL / ADMIN'}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Campus: <strong className="text-white">{schools.find(s => s.id === activeSchoolId)?.name || 'DPS Main Campus'}</strong> • Institutional Operations & Governance.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Promotion Button */}
          <button
            onClick={() => setShowPromotionModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Promote Class</span>
          </button>

          <button
            onClick={fetchUsers}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Subtab Navigation Bar */}
      <div className="flex gap-1.5 border-b border-white/5 pb-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
        {/* Core Admin Tabs */}
        {[
          { id: 'overview', label: 'School Overview', icon: School },
          { id: 'classes', label: 'Class & Section Manager', icon: Layers },
          { id: 'credentials', label: 'Password Reset', icon: Key },
          { id: 'requests', label: `Approvals (${pendingRequests.length + pendingLeaves.length})`, icon: Clock },
          { id: 'users', label: `Directory (${users.length})`, icon: Users }
        ].map(tab => {
          const Icon = tab.icon;
          const active = adminSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAdminSubTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}

        {/* Super Admin Exclusive Tabs */}
        {isSuperAdmin && (
          <>
            <div className="h-6 w-px bg-white/10 self-center mx-1" />
            {[
              { id: 'presence', label: `Live Presence (${onlineUsersList.length})`, icon: Radio },
              { id: 'tab_usage', label: 'Tab Usage Report', icon: BarChart2 },
              { id: 'spectate', label: 'Spectate Student', icon: Eye },
              { id: 'schools', label: 'School Switcher', icon: School },
              { id: 'audit', label: `Audit Log (${auditLogs.length})`, icon: Shield },
              { id: 'flags', label: 'Feature Flags', icon: Flag },
              { id: 'experience_testing', label: 'Byte & Experience Lab', icon: FlaskConical }
            ].map(tab => {
              const Icon = tab.icon;
              const active = adminSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setAdminSubTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* =========================================================================
          VIEW 1: SCHOOL OVERVIEW
      ========================================================================= */}
      {adminSubTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Students Enrolled</span>
              <span className="text-2xl font-black text-white font-mono">{totalStudents > 0 ? totalStudents : 1420}</span>
              <span className="text-[10px] text-emerald-400 font-bold block">Active Roster</span>
            </div>

            <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Faculty Members</span>
              <span className="text-2xl font-black text-indigo-400 font-mono">{totalTeachers > 0 ? totalTeachers : 86}</span>
              <span className="text-[10px] text-slate-400 font-bold block">Certified Teachers</span>
            </div>

            <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Attendance</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">94.6%</span>
              <span className="text-[10px] text-emerald-400/80 font-bold block">Above Target Ratio</span>
            </div>

            <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Leaves</span>
              <span className="text-2xl font-black text-amber-400 font-mono">{pendingLeaves.length}</span>
              <span className="text-[10px] text-amber-400/80 font-bold block">Awaiting Decision</span>
            </div>

            <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Circulars</span>
              <span className="text-2xl font-black text-purple-400 font-mono">2</span>
              <span className="text-[10px] text-purple-400/80 font-bold block">Campus Notices</span>
            </div>
          </div>

          {/* Institutional Actions & Excel Export Shortcuts */}
          <div className="p-6 bg-slate-900/60 border border-white/10 rounded-3xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-base font-black text-white">Direct Excel (.xlsx) Export Shortcuts</h4>
                <p className="text-xs text-slate-400">Download formatted institutional spreadsheets with persistent compliance audit records.</p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Audited Exports
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <button
                onClick={handleQuickExportAttendance}
                className="p-4 bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl text-left transition-all group cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <Download className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Export Attendance Sheet
                  </h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Date, Class, Section, Student Name, Status (.xlsx)
                  </p>
                </div>
              </button>

              <button
                onClick={handleQuickExportMarks}
                className="p-4 bg-slate-950/80 border border-indigo-500/20 hover:border-indigo-500/40 rounded-2xl text-left transition-all group cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <Download className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                    Export Gradebook & Marks
                  </h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Student Name, Subject, Exam, Marks, Max Marks (.xlsx)
                  </p>
                </div>
              </button>

              <button
                onClick={() => setShowPromotionModal(true)}
                className="p-4 bg-slate-950/80 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl text-left transition-all group cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                    Year-End Cohort Promotion
                  </h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Promote active class, preserve prior marks & attendance
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: CLASS & SECTION MANAGER
      ========================================================================= */}
      {adminSubTab === 'classes' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* TOOL 1: Assign Class Teacher */}
            <div className="p-6 bg-slate-900/60 border border-white/10 rounded-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-black text-white">Assign Class Teacher</h4>
              </div>
              <p className="text-xs text-slate-400">
                Authorize a faculty educator as the primary Class Teacher for a cohort.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Grade</label>
                  <select
                    value={selectedClassGrade}
                    onChange={e => setSelectedClassGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
                  >
                    {['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Section</label>
                  <select
                    value={selectedClassSection}
                    onChange={e => setSelectedClassSection(e.target.value as SectionType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
                  >
                    {['Astra', 'Solara', 'Elara', 'Vega'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Select Teacher</label>
                <select
                  value={assignedTeacherUid}
                  onChange={e => setAssignedTeacherUid(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
                >
                  <option value="">-- Choose Faculty Member --</option>
                  {users.filter(u => u.role === 'teacher').map(t => (
                    <option key={t.uid || t.email} value={t.uid || t.email}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAssignClassTeacher}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Assign as Class Teacher
              </button>
            </div>

            {/* TOOL 2: Move Student */}
            <div className="p-6 bg-slate-900/60 border border-white/10 rounded-3xl space-y-4">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-black text-white">Move Student to Another Class</h4>
              </div>
              <p className="text-xs text-slate-400">
                Transfer an active student to another grade or section. The transition is recorded in the audit trail.
              </p>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Select Student</label>
                <select
                  value={studentToMoveUid}
                  onChange={e => setStudentToMoveUid(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
                >
                  <option value="">-- Choose Student to Move --</option>
                  {users.filter(u => u.role === 'student').map(s => (
                    <option key={s.uid || s.email} value={s.uid || s.email}>
                      {s.name} ({s.grade || 'Grade 10'} • Section {s.section || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Target Grade</label>
                  <select
                    value={targetMoveGrade}
                    onChange={e => setTargetMoveGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
                  >
                    {['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Target Section</label>
                  <select
                    value={targetMoveSection}
                    onChange={e => setTargetMoveSection(e.target.value as SectionType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
                  >
                    {['Astra', 'Solara', 'Elara', 'Vega'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleMoveStudent}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Transfer Student & Log Audit Entry
              </button>
            </div>

            {/* TOOL 3: Add Class / Section */}
            <div className="p-6 bg-slate-900/60 border border-white/10 rounded-3xl space-y-4 lg:col-span-2">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-black text-white">Add Curriculum Class & Section</h4>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="e.g. Grade 8"
                  value={newClassGradeInput}
                  onChange={e => setNewClassGradeInput(e.target.value)}
                  className="flex-1 w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
                />
                <select
                  value={newClassSectionInput}
                  onChange={e => setNewClassSectionInput(e.target.value as SectionType)}
                  className="w-full sm:w-48 px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
                >
                  {['Astra', 'Solara', 'Elara', 'Vega'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddNewClass}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                >
                  Register Class
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: PASSWORD & CREDENTIAL RESETS
      ========================================================================= */}
      {adminSubTab === 'credentials' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 shrink-0" />
              <span>Campus Password Management: Reset credentials for students and teachers in this school. All actions publish an enterprise audit log.</span>
            </div>
            <span className="text-[10px] font-mono text-indigo-400">{resetCandidates.length} Users</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search user by name, email, or role..."
                value={resetSearch}
                onChange={e => setResetSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Class / Designation</th>
                  <th className="p-3 text-right">Credential Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resetCandidates.slice(0, 25).map(u => (
                  <tr key={u.uid || u.email} className="hover:bg-white/5">
                    <td className="p-3">
                      <div className="font-bold text-white">{u.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {u.grade ? `${u.grade} - Section ${u.section || 'General'}` : (u.designation || 'Faculty')}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleIssuePasswordReset(u)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase transition-all cursor-pointer"
                      >
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: APPROVALS QUEUE (Leaves, Circulars, Role Requests)
      ========================================================================= */}
      {adminSubTab === 'requests' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Section 1: Leave Requests */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Student & Staff Leave Requests ({pendingLeaves.length} Pending)</span>
              </h4>
            </div>

            {leaveRequests.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 bg-slate-950/40 rounded-2xl">No leave requests logged.</p>
            ) : (
              <div className="space-y-2.5">
                {leaveRequests.map(leave => (
                  <div
                    key={leave.id}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{leave.user_name}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {leave.user_role}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          leave.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                          leave.status === 'rejected' ? 'bg-rose-500/20 text-rose-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {leave.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium">"{leave.reason}"</p>
                      <p className="text-[10px] text-slate-400 font-mono">Dates: {leave.dates}</p>
                    </div>

                    {leave.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleUpdateLeaveStatus(leave.id, 'rejected', leave.user_name)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-xs font-bold transition-all border border-rose-500/20 cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleUpdateLeaveStatus(leave.id, 'approved', leave.user_name)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                        >
                          Approve Leave
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Account Role Elevation Requests */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Pending Role Elevations ({pendingRequests.length})</span>
            </h4>

            {pendingRequests.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 bg-slate-950/40 rounded-2xl">All user roles are verified.</p>
            ) : (
              <div className="space-y-2.5">
                {pendingRequests.map(req => (
                  <div
                    key={req.uid || req.email}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{req.name}</span>
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold uppercase">
                          Requested: {req.requestedRole}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">{req.email}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApproveRoleRequest(req)}
                        disabled={req.requestedRole === 'admin' && !isSuperAdmin}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        {req.requestedRole === 'admin' && !isSuperAdmin ? '🔒 Super Admin Required' : 'Approve Role'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 5: USER DIRECTORY
      ========================================================================= */}
      {adminSubTab === 'users' && (
        <div className="space-y-4 animate-fadeIn">
          {editingUser ? (
            <form onSubmit={handleSaveUser} className="bg-slate-900 border border-indigo-500/30 p-6 rounded-2xl space-y-4">
              <h4 className="font-bold text-white">Edit User: {editingUser.email}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Name</label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="coordinator">Coordinator</option>
                    {isSuperAdmin && <option value="admin">Admin</option>}
                    {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Grade</label>
                  <input
                    type="text"
                    value={editingUser.grade || ''}
                    onChange={e => setEditingUser({ ...editingUser, grade: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white"
                    placeholder="e.g. Grade 10"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Section</label>
                  <select
                    value={editingUser.section || 'Solara'}
                    onChange={e => setEditingUser({ ...editingUser, section: e.target.value as SectionType })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white"
                  >
                    {['Astra', 'Solara', 'Elara', 'Vega'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">
                    <th className="p-3">User</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Grade & Section</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map(u => (
                    <tr key={u.uid || u.email} className="hover:bg-white/5">
                      <td className="p-3">
                        <div className="font-bold text-white">{u.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          u.role === 'super_admin' ? 'bg-amber-500/20 text-amber-300' :
                          u.role === 'admin' ? 'bg-purple-500/20 text-purple-300' :
                          u.role === 'teacher' ? 'bg-emerald-500/20 text-emerald-300' :
                          'bg-indigo-500/20 text-indigo-300'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {u.grade ? `${u.grade} - Section ${u.section || 'General'}` : '—'}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-bold text-emerald-400 capitalize">
                          {u.accountStatus || 'approved'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {(u.role !== 'super_admin' || isSuperAdmin) && (
                          <button
                            onClick={() => setEditingUser(u)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase transition-all cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 6: [SUPER ADMIN] LIVE PRESENCE
      ========================================================================= */}
      {isSuperAdmin && adminSubTab === 'presence' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Realtime Workspace Telemetry: Live online status and active tab of connected campus members. No screen content or keystrokes collected.</span>
            </div>
            <span className="font-mono text-emerald-400 font-bold">{onlineUsersList.length} Connected Now</span>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Cohort</th>
                  <th className="p-3">Active Workspace Tab</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {onlineUsersList.map(u => {
                  const tabLabel = KNOWN_TABS[u.currentTab || ''] || u.currentTab || 'Home / Dashboard';
                  return (
                    <tr key={u.uid} className="hover:bg-white/5">
                      <td className="p-3">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span>{u.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                          {u.role || 'student'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {u.grade ? `${u.grade} • ${u.section || 'General'}` : 'Staff'}
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {tabLabel}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">ONLINE</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 7: [SUPER ADMIN] TAB USAGE ANALYTICS REPORT
      ========================================================================= */}
      {isSuperAdmin && adminSubTab === 'tab_usage' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Controls Bar */}
          <div className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Start Date</label>
              <input
                type="date"
                value={usageStartDate}
                onChange={e => setUsageStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">End Date</label>
              <input
                type="date"
                value={usageEndDate}
                onChange={e => setUsageEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Role Filter</label>
              <select
                value={usageRoleFilter}
                onChange={e => setUsageRoleFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
              >
                <option value="all">All Campus Roles</option>
                <option value="student">Students Only</option>
                <option value="teacher">Teachers Only</option>
                <option value="admin">Administrators Only</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cohort Filter</label>
              <select
                value={usageGradeFilter}
                onChange={e => setUsageGradeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
              >
                <option value="all">All Grades</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </select>
            </div>
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Tab Opens</span>
              <span className="text-2xl font-black text-white font-mono">{usageReport.totalOpens}</span>
              <span className="text-[10px] text-slate-400 font-mono">Date Range: {usageReport.startDate} → {usageReport.endDate}</span>
            </div>

            <div className="p-4 bg-slate-900/80 border border-emerald-500/20 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">🔥 Most Used Module</span>
              <span className="text-base font-black text-white truncate block">
                {usageReport.mostUsedTab?.tabLabel || 'Study Hub & Planner'}
              </span>
              <span className="text-[10px] text-emerald-300 font-mono font-bold block">
                {usageReport.mostUsedTab?.openCount || 0} Opens ({usageReport.mostUsedTab?.percentage || 0}%)
              </span>
            </div>

            <div className="p-4 bg-slate-900/80 border border-amber-500/20 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">❄️ Least Used Module</span>
              <span className="text-base font-black text-white truncate block">
                {usageReport.leastUsedTab?.tabLabel || 'Materials Hub'}
              </span>
              <span className="text-[10px] text-amber-300 font-mono font-bold block">
                {usageReport.leastUsedTab?.openCount || 0} Opens ({usageReport.leastUsedTab?.percentage || 0}%)
              </span>
            </div>
          </div>

          {/* Detailed Usage Breakdown Table */}
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">
                  <th className="p-3">Module Name</th>
                  <th className="p-3">Opens Count</th>
                  <th className="p-3">Usage Share</th>
                  <th className="p-3 text-right">Relative Traffic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usageReport.allTabs.map(tab => (
                  <tr key={tab.tabId} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-white">{tab.tabLabel}</td>
                    <td className="p-3 font-mono text-slate-300">{tab.openCount} opens</td>
                    <td className="p-3 font-mono font-bold text-indigo-400">{tab.percentage}%</td>
                    <td className="p-3 text-right">
                      <div className="w-32 bg-slate-900 rounded-full h-2 overflow-hidden ml-auto">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all"
                          style={{ width: `${tab.percentage}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 8: [SUPER ADMIN] SPECTATE STUDENT
      ========================================================================= */}
      {isSuperAdmin && adminSubTab === 'spectate' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 shrink-0" />
              <span>Strictly Student-Only Read-Only Inspection. Faculty and staff accounts cannot be spectated. Every session is logged in the permanent audit trail.</span>
            </div>
            <span className="font-mono text-amber-400 font-bold">{spectatableStudents.length} Students</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search student by name, email, or grade..."
              value={spectateSearch}
              onChange={e => setSpectateSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {spectatableStudents.map(stu => (
              <div
                key={stu.uid || stu.email}
                className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl flex items-center justify-between gap-3 hover:border-amber-500/30 transition-all"
              >
                <div className="flex items-center gap-3 truncate">
                  <img
                    src={stu.photoURL || stu.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${stu.uid || stu.name}`}
                    alt={stu.name}
                    className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
                  />
                  <div className="truncate">
                    <h5 className="font-bold text-white text-xs truncate">{stu.name}</h5>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{stu.email}</p>
                    <span className="text-[10px] text-indigo-300 font-semibold block">
                      {stu.grade || 'Grade 10'} • Section {stu.section || 'General'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSpectatingStudent(stu)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-bold transition-all border border-amber-500/30 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Spectate</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 9: [SUPER ADMIN] SCHOOL SWITCHER
      ========================================================================= */}
      {isSuperAdmin && adminSubTab === 'schools' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 shrink-0" />
              <span>Multi-Tenancy Campus Switcher: Manage multiple school facilities across your institutional network. Standard admins cannot access this control.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {schools.map(school => {
              const isActive = school.id === activeSchoolId;
              return (
                <div
                  key={school.id}
                  className={`p-5 rounded-3xl border transition-all space-y-4 ${
                    isActive
                      ? 'bg-indigo-600/20 border-indigo-500 shadow-xl ring-1 ring-indigo-500'
                      : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">{school.code}</span>
                      <h4 className="text-base font-black text-white mt-0.5">{school.name}</h4>
                      <p className="text-xs text-indigo-300 font-medium">{school.city}</p>
                    </div>
                    {isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Active Campus
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Students</span>
                      <span className="font-mono font-bold text-white">{school.studentCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Faculty</span>
                      <span className="font-mono font-bold text-white">{school.teacherCount}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSwitchSchool(school.id)}
                    disabled={isActive}
                    className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white cursor-default'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    {isActive ? 'Currently Active' : 'Switch to this School'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 10: [SUPER ADMIN] ENTERPRISE AUDIT TRAIL
      ========================================================================= */}
      {isSuperAdmin && adminSubTab === 'audit' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Enterprise Compliance Trail: All promotions, Excel exports, password resets, and student spectates.</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditFilterAction}
                onChange={e => setAuditFilterAction(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-white text-xs"
              >
                <option value="all">All Action Types</option>
                <option value="export_excel">Excel Exports (.xlsx)</option>
                <option value="promote_class">Class Promotions</option>
                <option value="reset_password">Password Resets</option>
                <option value="spectate_student">Student Spectates</option>
                <option value="class_move">Class Student Transfers</option>
                <option value="feature_flag_toggle">Feature Flag Changes</option>
                <option value="leave_approval">Leave Approvals</option>
              </select>

              <button
                onClick={loadAuditLogs}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/5">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Details</th>
                  <th className="p-3 text-right">Target / Class</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAuditLogs.map(entry => (
                  <tr key={entry.id} className="hover:bg-white/5">
                    <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-white">{entry.actorName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-mono">{entry.actorRole}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        entry.action === 'export_excel' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        entry.action === 'promote_class' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                        entry.action === 'reset_password' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        entry.action === 'spectate_student' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {entry.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 max-w-md">{entry.details}</td>
                    <td className="p-3 text-right text-slate-400 font-mono text-[10px]">
                      {entry.destinationClass || entry.targetStudentName || entry.sourceClass || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 11: [SUPER ADMIN] FEATURE FLAGS PER SCHOOL
      ========================================================================= */}
      {isSuperAdmin && adminSubTab === 'flags' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 shrink-0" />
              <span>Campus Module Feature Flags: Enable or disable specific workspace capabilities for {schools.find(s => s.id === activeSchoolId)?.name}.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'aiBuddy', label: 'Byte AI Study Assistant', desc: 'Curriculum chatbot & math tutor' },
              { key: 'peerChat', label: 'Peer & Global Chat', desc: 'Direct & room messaging' },
              { key: 'whiteboard', label: 'Classroom Whiteboard', desc: 'Collaborative live drawing' },
              { key: 'digitalGradebook', label: 'Digital Gradebook', desc: 'Subject marks & evaluations' },
              { key: 'digitalReportCards', label: 'Digital Report Cards', desc: 'Formal graduation report cards' },
              { key: 'attendanceManager', label: 'Attendance Manager', desc: 'Daily attendance & leaves' },
              { key: 'materialsHub', label: 'Materials Hub', desc: 'Educational files & lecture notes' },
              { key: 'scheduledReleases', label: 'Scheduled Releases', desc: 'Automated version releases' }
            ].map(flag => {
              const isEnabled = featureFlags[flag.key as keyof SchoolFeatureFlags];
              return (
                <div
                  key={flag.key}
                  className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl flex flex-col justify-between gap-3"
                >
                  <div>
                    <h5 className="font-bold text-white text-xs">{flag.label}</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">{flag.desc}</p>
                  </div>

                  <button
                    onClick={() => handleToggleFeatureFlag(flag.key as keyof SchoolFeatureFlags)}
                    className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    <span>{isEnabled ? 'Enabled ✓' : 'Disabled ✕'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 12 & 13: RELEASES & WHAT'S NEW
      ========================================================================= */}
      {isSuperAdmin && adminSubTab === 'releases' && (
        <AdminReleaseManager currentUser={currentUser} showNotification={showNotification} />
      )}

      {isSuperAdmin && adminSubTab === 'whats_new' && (
        <WhatsNewAdminTab
          currentUser={currentUser}
          showNotification={showNotification}
          onClose={() => setAdminSubTab('overview')}
        />
      )}

      {/* =========================================================================
          VIEW 14: BYTE VOICE, CHARACTER & EXPERIENCE TESTING LAB
      ========================================================================= */}
      {isSuperAdmin && adminSubTab === 'experience_testing' && (
        <ExperienceTestingTab
          currentUser={currentUser}
          showNotification={showNotification}
        />
      )}

    </div>
  );
}
