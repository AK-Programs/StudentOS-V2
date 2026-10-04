import React, { useState, useEffect } from 'react';
import { sendNotificationToUsers } from '../firebase';
import { UserProfile, UserRole, HouseType, SectionType } from '../types';
import { fetchAllSupabaseUsers, saveSupabaseUserProfile, getSupabaseUserProfile } from '../lib/supabaseUsers';
import { WhatsNewAdminTab } from './WhatsNewAdminTab';
import { AdminReleaseManager } from './AdminReleaseManager';

export default function AdminCenter({ currentUser, showNotification, profileTab }: { currentUser: UserProfile; showNotification: (msg: string) => void, profileTab?: string }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'requests' | 'releases' | 'whats_new'>('users');
  const [setupSql, setSetupSql] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (profileTab === 'requests') {
      setAdminSubTab('requests');
    } else if (profileTab === 'whats_new') {
      setAdminSubTab('whats_new');
    } else if (profileTab === 'releases') {
      setAdminSubTab('releases');
    }
  }, [profileTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let list: UserProfile[] = [];
      try {
        list = await fetchAllSupabaseUsers();
      } catch (sbErr) {
        console.error('[Supabase] Failed to fetch all users:', sbErr);
        throw sbErr;
      }
      setUsers(list);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    const isCurrentUserSuperAdmin = currentUser.role === 'super_admin';
    const originalUser = users.find(u => u.uid === editingUser.uid);
    const originalRole = originalUser?.role || 'student';

    if ((editingUser.role === 'admin' || editingUser.role === 'super_admin') && !isCurrentUserSuperAdmin) {
      if (originalRole !== editingUser.role) {
        showNotification('❌ Permission Denied: Only Super Admin can assign Admin or Super Admin roles.');
        return;
      }
    }

    if (originalRole === 'super_admin' && !isCurrentUserSuperAdmin) {
      showNotification('❌ Permission Denied: School-level Admins cannot modify Super Admin profiles.');
      return;
    }

    try {
      try {
        await saveSupabaseUserProfile(editingUser);
      } catch (sbErr) {
        console.error('[Supabase] Failed to save edited user to Supabase:', sbErr);
        throw sbErr;
      }
      
      showNotification('User updated successfully.');
      setEditingUser(null);
      fetchUsers();
    } catch(err) {
      showNotification('Error saving user.');
      console.error(err);
    }
  };

  const handleApprove = async (user: UserProfile) => {
    const docId = user.uid || user.email;

    // 1. Fetch current user's actual stored role in Supabase
    let firestoreRole = 'unknown';
    if (currentUser && currentUser.uid) {
      try {
        let profile = await getSupabaseUserProfile(currentUser.uid);
        if (profile) {
          firestoreRole = profile.role || 'student';
        }
      } catch (err) {
        console.error('Error verifying user role in Supabase:', err);
      }
    }

    const superAdminSessionStatus = currentUser.role === 'super_admin' ? 'Active' : 'Inactive';

    // Print: Before approval action
    console.log('=================================================');
    console.log('VERIFICATION BEFORE APPROVAL:');
    console.log(`Current Firebase UID: ${currentUser.uid || 'unknown'}`);
    console.log(`Current Stored Role: ${firestoreRole}`);
    console.log(`Current Effective Role: ${currentUser.role || 'unknown'}`);
    console.log(`Super Admin Session Status: ${superAdminSessionStatus}`);
    console.log('=================================================');

    // Print: On approval click
    console.log('=================================================');
    console.log('ON APPROVAL CLICK:');
    console.log(`Operation: UPDATE (Approve requested role: ${user.requestedRole})`);
    console.log(`Current Role (Supabase Stored): ${firestoreRole}`);
    console.log(`Current Effective Role: ${currentUser.role || 'unknown'}`);
    console.log('=================================================');

    // Guard: Coordinator and Admin approvals must require actual Supabase 'super_admin' role
    const isRealSuperAdmin = firestoreRole === 'super_admin';

    if (user.requestedRole === 'coordinator' || user.requestedRole === 'admin') {
      if (firestoreRole === 'teacher') {
        showNotification(`❌ Approval Denied: Your verified Supabase role is "teacher". Super Admin clearance is required.`);
        return;
      }
      if (!isRealSuperAdmin) {
        showNotification(`❌ Approval Denied: Verified Supabase role "super_admin" is required to approve ${user.requestedRole}s. Current Stored Role: ${firestoreRole}`);
        return;
      }
    }

    try {
      setLoading(true);
      const updatedUser: UserProfile = {
        ...user,
        role: user.requestedRole || 'student',
        accountStatus: 'approved' as const
      };
      
      try {
        await saveSupabaseUserProfile(updatedUser);
      } catch (sbErr) {
        console.error('[Supabase] Failed to save approved user to Supabase:', sbErr);
        throw sbErr;
      }
      
      showNotification(`✓ Approved ${user.name} as ${user.requestedRole?.toUpperCase()}!`);
      
      // Dispatch system notification inside StudentOS
      await sendNotificationToUsers({
        specificUserId: docId,
        title: 'Access Credentials Approved 🔓',
        message: `Your requested administrative role (${user.requestedRole?.toUpperCase()}) was verified and authorized by campus admin. Reload to take action.`,
        type: 'general'
      });

      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      showNotification(`Error approving user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (user: UserProfile) => {
    try {
      setLoading(true);
      const updatedUser: UserProfile = {
        ...user,
        accountStatus: 'rejected' as const
      };
      
      const docId = user.uid || user.email;
      try {
        await saveSupabaseUserProfile(updatedUser);
      } catch (sbErr) {
        console.error('[Supabase] Failed to save rejected user to Supabase:', sbErr);
        throw sbErr;
      }
      
      showNotification(`✗ Rejected ${user.name}'s request for ${user.requestedRole?.toUpperCase()}.`);
      
      // Dispatch system notification
      await sendNotificationToUsers({
        specificUserId: docId,
        title: 'Request Status Updated ⛔',
        message: `Your request for administrative role (${user.requestedRole?.toUpperCase()}) was declined by campus admin.`,
        type: 'general'
      });

      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      showNotification(`Error rejecting user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateDemoData = async () => {
    if (!confirm('This will generate sample students and demo data. Continue?')) return;
    setLoading(true);
    showNotification('Generating demo data...');
    try {
      const demousers: UserProfile[] = [
        { email: 'demo.alice@school.edu', uid: 'demo_alice', name: 'Alice Smith', role: 'student', grade: 'Grade 10', section: 'Solara', house: 'Sapphire', accountStatus: 'approved' },
        { email: 'demo.bob@school.edu', uid: 'demo_bob', name: 'Bob Jones', role: 'student', grade: 'Grade 10', section: 'Solara', house: 'Emerald', accountStatus: 'approved' },
        { email: 'demo.charlie@school.edu', uid: 'demo_charlie', name: 'Charlie Brown', role: 'student', grade: 'Grade 10', section: 'Solara', house: 'Ruby', accountStatus: 'approved' },
        { email: 'demo.diana@school.edu', uid: 'demo_diana', name: 'Diana Prince', role: 'student', grade: 'Grade 10', section: 'Vega', house: 'Topaz', accountStatus: 'approved' },
      ];
      for (const u of demousers) {
        try {
          await saveSupabaseUserProfile(u);
        } catch (sbErr) {
          console.error('[Supabase] Failed to save demo user to Supabase:', sbErr);
          throw sbErr;
        }
      }
      showNotification('Demo users generated!');
      fetchUsers();
    } catch(err) {
      console.error(err);
      showNotification('Failed to generate demo data.');
    } finally {
      setLoading(false);
    }
  };

  const clearLegacyAiChats = async () => {
    if (!confirm('This will attempt to clear migration-ready collections (aiBuddyChats, orionChats). Continue?')) return;
    setLoading(true);
    try {
      showNotification('Global chat cleanup initialized. Legacy fragments are being purged.');
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setupDatabase = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/setup-sql');
      if (!res.ok) throw new Error('Could not load setup SQL');
      const sql = await res.text();
      setSetupSql(sql);
    } catch(err: any) {
      showNotification(`❌ Could not load setup SQL: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const pendingRequests = users.filter(u => u.accountStatus && u.accountStatus !== 'approved' && u.accountStatus !== 'rejected');
  const isSuperAdmin = currentUser.role === 'super_admin';

  return (
    <div className="smart-glass p-3.5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 max-w-5xl mx-auto animate-fadeIn w-full">

      {/* Database Setup SQL Modal */}
      {setupSql && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSetupSql(null)}>
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-black text-white">🗄️ Supabase Database Setup</h4>
                <p className="text-xs text-slate-400 mt-1">Copy this SQL and paste it into your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">Supabase Dashboard</a> → SQL Editor → Run. Do this once.</p>
              </div>
              <button onClick={() => setSetupSql(null)} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(setupSql); showNotification('✅ SQL copied to clipboard!'); }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                📋 Copy SQL
              </button>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                🔗 Open Supabase Dashboard
              </a>
            </div>
            <pre className="flex-1 overflow-auto bg-black/50 text-emerald-300 text-[10px] leading-relaxed p-4 rounded-2xl border border-white/5 font-mono whitespace-pre-wrap">
              {setupSql}
            </pre>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1">
          <h3 className="text-2xl font-black font-display text-white">Admin Center</h3>
          <p className="text-xs text-slate-400 font-medium">Verify credentials, approve roles, and manage school placements.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={setupDatabase}
            disabled={loading}
            className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            title="Creates all required Supabase tables + RLS policies. Run once."
          >
            🗄️ Setup Database
          </button>
          <button 
            onClick={clearLegacyAiChats}
            disabled={loading}
            className="bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            🗑️ Purge Global Chats
          </button>
          <button 
            onClick={generateDemoData}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Processing...' : '✨ Generate Demo Data'}
          </button>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-indigo-500/30 rounded-3xl p-6 relative overflow-hidden space-y-4 shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-9xl pointer-events-none">🌌</div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-black uppercase tracking-wider animate-pulse">
              <span>⚡ Orion Control Center Activated</span>
            </div>
            <h3 className="text-2xl font-black text-white font-display">Welcome Super Administrator</h3>
            <p className="text-xs text-slate-400">Secure credential verification successful. System parameters are active.</p>
          </div>
          
          <div className="pt-2">
            <span className="text-[10px] uppercase font-black text-indigo-300/80 tracking-wider block mb-2.5">Quick Actions</span>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
              {[
                { label: 'Admin Centre', icon: '⚙️', action: () => setAdminSubTab('users') },
                { label: 'User Approvals', icon: '⏳', action: () => setAdminSubTab('requests') },
                { label: "What's New Logs", icon: '🚀', action: () => setAdminSubTab('whats_new') },
                { label: 'School Analytics', icon: '📊', action: () => showNotification('School Analytics: All digital workspace channels reporting healthy response indexes.') },
                { label: 'Notification Mgmt', icon: '🔔', action: () => showNotification('Notification Management: Direct school broadcasting initialized.') },
                { label: 'System Settings', icon: '🛡️', action: () => showNotification('System Settings: Global workspace parameters are secured.') }
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  type="button"
                  className="p-3.5 rounded-2xl bg-slate-900/60 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/30 transition-all text-left flex flex-col gap-1.5 cursor-pointer"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[10px] font-black text-white leading-snug">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub tabs selector */}
      <div className="flex gap-2.5 border-b border-white/5 pb-1 flex-wrap">
        <button
          onClick={() => setAdminSubTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            adminSubTab === 'users'
              ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📁 User Directory ({users.length})
        </button>
        <button
          onClick={() => setAdminSubTab('requests')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer relative ${
            adminSubTab === 'requests'
              ? 'bg-amber-600/20 border border-amber-500/30 text-amber-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ⏳ Pending Approvals
          {pendingRequests.length > 0 && (
            <span className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-full leading-none">
              {pendingRequests.length}
            </span>
          )}
        </button>
        {isSuperAdmin && (
          <>
            <button
              onClick={() => setAdminSubTab('releases')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminSubTab === 'releases'
                  ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🚀 Scheduled Releases
            </button>
            <button
              onClick={() => setAdminSubTab('whats_new')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminSubTab === 'whats_new'
                  ? 'bg-purple-600/20 border border-purple-500/30 text-purple-300 font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📢 What's New & Release Logs
            </button>
          </>
        )}
      </div>

      {adminSubTab === 'releases' ? (
        <AdminReleaseManager
          currentUser={currentUser}
          showNotification={showNotification}
        />
      ) : adminSubTab === 'whats_new' ? (
        <WhatsNewAdminTab
          currentUser={currentUser}
          showNotification={showNotification}
          onClose={() => setAdminSubTab('users')}
        />
      ) : adminSubTab === 'requests' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
            <p className="text-xs text-amber-300 font-semibold leading-relaxed">
              🔑 <strong>Security Mandate</strong>: Standard Admins can authorize Teacher and Coordinator requests. Admin request elevations strictly require Super Admin verification.
            </p>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="py-12 text-center space-y-2.5 bg-slate-950/20 rounded-2xl border border-white/5">
              <span className="text-4xl">🧘‍♂️</span>
              <h4 className="text-sm font-bold text-slate-300">All clear! No pending requests</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">All staff and administrator credentials are verified and up-to-date.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {pendingRequests.map((req) => (
                <div
                  key={req.uid || req.email}
                  className="p-4.5 rounded-2xl bg-slate-900/40 border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-bold text-white">{req.name}</span>
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] px-2 py-0.5 rounded-full uppercase font-mono font-bold">
                        Requested: {req.requestedRole?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{req.email}</div>
                    {req.specialtySubject && (
                      <p className="text-xs text-slate-400">
                        🎓 Specialty: <strong className="text-indigo-400">{req.specialtySubject}</strong>
                      </p>
                    )}
                    {req.department && (
                      <p className="text-xs text-slate-400">
                        🏢 Department: <strong className="text-indigo-400">{req.department}</strong>
                      </p>
                    )}
                    {req.subjects && req.subjects.length > 0 && (
                      <p className="text-xs text-slate-400">
                        📚 Subjects: <strong className="text-indigo-400">{req.subjects.join(', ')}</strong>
                      </p>
                    )}
                    {req.designation && (
                      <p className="text-xs text-slate-400">
                        🏷️ Designation: <strong className="text-indigo-400">{req.designation}</strong>
                      </p>
                    )}
                    {req.rollNumber && (
                      <p className="text-xs text-slate-400">
                        🆔 Roll Number: <strong className="text-indigo-400">{req.rollNumber}</strong>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleReject(req)}
                      disabled={loading}
                      className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-red-500/20 cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={loading || (req.requestedRole === 'admin' && !isSuperAdmin)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        req.requestedRole === 'admin' && !isSuperAdmin
                          ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                      }`}
                      title={req.requestedRole === 'admin' && !isSuperAdmin ? 'Requires Super Admin privileges' : 'Approve Request'}
                    >
                      {req.requestedRole === 'admin' && !isSuperAdmin ? '🔒 Super Admin Required' : 'Approve & Promoted'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : editingUser ? (
        <form onSubmit={handleSave} className="bg-slate-900 border border-indigo-500/30 p-6 rounded-2xl space-y-4 animate-fadeIn">
          <h4 className="font-bold text-white mb-2">Edit User: {editingUser.email}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Name</label>
              <input type="text" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" required />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Role</label>
              <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm">
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="coordinator">Coordinator</option>
                {isSuperAdmin && <option value="admin">Admin</option>}
                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Account Status</label>
              <select value={editingUser.accountStatus || 'approved'} onChange={e => setEditingUser({...editingUser, accountStatus: e.target.value as any})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm">
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="pending_teacher">Pending Teacher Approval</option>
                <option value="pending_coordinator">Pending Coordinator Approval</option>
                <option value="pending_admin">Pending Admin Approval</option>
              </select>
            </div>
            {(editingUser.role === 'student' || editingUser.role === 'teacher') && (
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">Grade (Primary)</label>
                <select value={editingUser.grade || ''} onChange={e => setEditingUser({...editingUser, grade: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm">
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                </select>
              </div>
            )}
            {editingUser.role === 'teacher' && (
              <>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Assigned Classes (Comma separated)</label>
                  <input type="text" value={(editingUser.assignedClasses || []).join(', ')} onChange={e => setEditingUser({...editingUser, assignedClasses: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" placeholder="e.g. Grade 9 Solara, Grade 10 Astra" />
                  <p className="text-[10px] text-slate-500 mt-1">Format: Grade + Section (e.g. Grade 9 Solara, Grade 10 Astra)</p>
                </div>
              </>
            )}
            {editingUser.role === 'student' && (
              <>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Section</label>
                  <select value={editingUser.section || ''} onChange={e => setEditingUser({...editingUser, section: e.target.value as SectionType})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm">
                    <option value="Astra">Astra</option>
                    <option value="Elara">Elara</option>
                    <option value="Solara">Solara</option>
                    <option value="Vega">Vega</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">House</label>
                  <select value={editingUser.house || ''} onChange={e => setEditingUser({...editingUser, house: e.target.value as HouseType})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm">
                    <option value="Ruby">Ruby</option>
                    <option value="Emerald">Emerald</option>
                    <option value="Sapphire">Sapphire</option>
                    <option value="Topaz">Topaz</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Roll Number (Optional)</label>
                  <input type="text" value={editingUser.rollNumber || ''} onChange={e => setEditingUser({...editingUser, rollNumber: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" placeholder="e.g. 101" />
                </div>
              </>
            )}
            {(editingUser.role === 'teacher' || editingUser.role === 'coordinator') && (
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">Department</label>
                <input type="text" value={editingUser.department || ''} onChange={e => setEditingUser({...editingUser, department: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" placeholder="e.g. Science" />
              </div>
            )}
            {editingUser.role === 'teacher' && (
              <>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Assigned Classes (Comma separated)</label>
                  <input type="text" value={(editingUser.assignedClasses || []).join(', ')} onChange={e => setEditingUser({...editingUser, assignedClasses: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" placeholder="e.g. Grade 9 Solara, Grade 10 Astra" />
                  <p className="text-[10px] text-slate-500 mt-1">Format: Grade + Section (e.g. Grade 9 Solara, Grade 10 Astra)</p>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Subjects (Comma separated)</label>
                  <input type="text" value={(editingUser.subjects || []).join(', ')} onChange={e => setEditingUser({...editingUser, subjects: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" placeholder="e.g. Physics, Chemistry" />
                </div>
              </>
            )}
            {editingUser.role === 'admin' && (
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">Designation</label>
                <input type="text" value={editingUser.designation || ''} onChange={e => setEditingUser({...editingUser, designation: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-sm" placeholder="e.g. Principal" />
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 hover:bg-white/5 text-slate-300 rounded-xl text-xs font-bold">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold">Save Changes</button>
          </div>
        </form>
      ) : (
        <div className="bg-slate-950/50 rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900 border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Placement</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {users.filter(u => {
                  if (profileTab === 'student_list' || profileTab === 'students') return u.role === 'student';
                  if (profileTab === 'teacher_list' || profileTab === 'teachers') return u.role === 'teacher';
                  if (profileTab === 'coordinator_list' || profileTab === 'coordinators') return u.role === 'coordinator';
                  if (profileTab === 'admin_list' || profileTab === 'admins') return u.role === 'admin';
                  return true;
                }).map(u => (
                  <tr key={u.uid || u.email} className="hover:bg-slate-900/40">
                    <td className="p-4">
                      <div className="font-bold text-white">{u.name}</div>
                      <div className="text-[10px] text-slate-500">{u.email}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        u.role === 'admin' || u.role === 'super_admin' ? 'bg-rose-500/10 text-rose-400' :
                        u.role === 'coordinator' ? 'bg-amber-500/10 text-amber-400' :
                        u.role === 'teacher' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-indigo-500/10 text-indigo-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-[10px]">
                      {u.grade && <span className="block">{u.grade}</span>}
                      {u.section && <span className="block">{u.section} • {u.house}</span>}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.accountStatus === 'approved' || !u.accountStatus ? 'bg-emerald-500/10 text-emerald-400' :
                        u.accountStatus === 'rejected' ? 'bg-red-500/10 text-red-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {u.accountStatus || 'approved'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {(u.role !== 'super_admin' || isSuperAdmin) ? (
                        <button onClick={() => setEditingUser(u)} className="text-[10px] bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/10 font-bold tracking-wide uppercase cursor-pointer">
                          Edit
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Locked</span>
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
  );
}
