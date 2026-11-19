import React, { useState } from 'react';
import { Megaphone, Send, X, Filter } from 'lucide-react';
import { UserProfile, AppNotification } from '../types';
import { saveAppNotification, generateUUID } from '../lib/notifications';
import { buildAuthHeadersForUser } from '../lib/featureAccessService';
import { supabase } from '../lib/supabase';

interface BroadcastModalProps {
  currentUser: UserProfile | null;
  effectiveRole?: string;
  isOpen?: boolean;
  onClose: () => void;
  onBroadcastSent?: () => void;
  showNotification?: (msg: string) => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  currentUser,
  effectiveRole,
  isOpen = true,
  onClose,
  onBroadcastSent,
  showNotification,
}) => {
  const role = effectiveRole || currentUser?.role || 'student';
  const isPrincipal = role === 'admin' || role === 'super_admin' || role === 'coordinator';
  const isTeacher = role === 'teacher';

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent' | 'emergency'>('urgent');
  const [category, setCategory] = useState<'announcement' | 'homework' | 'exam' | 'reminder' | 'notice'>('announcement');
  const [targetRoleAudience, setTargetRoleAudience] = useState<'all' | 'student' | 'faculty' | 'admin'>('all');
  const [ttlHours, setTtlHours] = useState<number>(72);

  const [targetGrade, setTargetGrade] = useState<string>('All Grades');
  const [targetSection, setTargetSection] = useState<string>('All Sections');
  const [targetSubject, setTargetSubject] = useState<string>('General');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setIsSubmitting(true);

    try {
      const notifId = generateUUID();
      const targetRoles =
        targetRoleAudience === 'faculty'
          ? ['teacher', 'coordinator']
          : targetRoleAudience === 'admin'
            ? ['admin', 'super_admin']
            : [targetRoleAudience];
      const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

      let deliveredViaServer = false;
      try {
        const headers = await buildAuthHeadersForUser({
          ...currentUser,
          role: role as any,
        });
        const res = await fetch('/api/notifications/broadcast', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: notifId,
            title: title.trim(),
            message: message.trim(),
            type: category === 'notice' ? 'announcement' : category,
            priority,
            targetUserId: 'all',
            targetRole: targetRoles[0],
            targetRoles,
            targetClass: targetGrade !== 'All Grades' ? targetGrade : 'all',
            targetSection: targetSection !== 'All Sections' ? targetSection : 'all',
            linkTab: category === 'homework' ? 'homework' : 'notice_viewer',
            expiresInHours: ttlHours,
            dedupeKey: `broadcast:${role}:${targetRoleAudience}:${title.trim().toLowerCase().slice(0, 48)}:${Math.floor(Date.now() / 60000)}`,
          }),
        });
        if (res.ok) {
          deliveredViaServer = true;
        }
      } catch (_) {}

      const newNotif: AppNotification = {
        id: notifId,
        title: title.trim(),
        message: message.trim(),
        type: category === 'notice' ? 'announcement' : category,
        createdAt: new Date().toISOString(),
        isRead: false,
        targetUserId: 'all',
        targetRole: targetRoles[0] as any,
        targetClass: targetGrade !== 'All Grades' ? targetGrade : 'all',
        targetSection: targetSection !== 'All Sections' ? targetSection : 'all',
        linkTab: category === 'homework' ? 'homework' : 'notice_viewer',
      };

      if (!deliveredViaServer) {
        await saveAppNotification({ ...newNotif, priority, targetRoles, expiresAt } as any);
      }

      const broadcastPayload = {
        id: notifId,
        title: title.trim(),
        message: message.trim(),
        senderName: currentUser?.name || 'School Principal',
        senderRole: role,
        priority,
        category,
        targetRole: targetRoles[0],
        targetRoles,
        targetGrade,
        targetClass: targetGrade !== 'All Grades' ? targetGrade : 'all',
        targetSection: targetSection !== 'All Sections' ? targetSection : 'all',
        targetSubject,
        expiresAt,
        createdAt: new Date().toISOString(),
      };

      // Emit once per targeted channel (no triple redundant broadcasts)
      try {
        await supabase.channel('student-os-public').send({
          type: 'broadcast',
          event: 'principal_live_broadcast',
          payload: broadcastPayload,
        });
      } catch (_) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studentos-live-broadcast', { detail: broadcastPayload }));
        window.dispatchEvent(new CustomEvent('studentos-notif-state-change'));
      }

      if (showNotification) {
        showNotification(`📢 Broadcast published (${targetRoleAudience}, expires in ${ttlHours}h).`);
      }

      setTitle('');
      setMessage('');
      setIsSubmitting(false);
      if (onBroadcastSent) onBroadcastSent();
      onClose();
    } catch (err) {
      console.error('[BROADCAST] Error sending broadcast:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative animate-scaleUp">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                {isPrincipal ? 'Institutional Live Broadcast' : 'Faculty Class Broadcast'}
              </h3>
              <p className="text-xs text-slate-400">Role-targeted, expiring push notice & banner</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSendBroadcast} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Notice Title
            </label>
            <input
              type="text"
              required
              placeholder={isPrincipal ? 'e.g. Tomorrow campus assembly at 8:30 AM' : 'e.g. Physics Lab Assignment Due Tomorrow'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="announcement">Announcement</option>
                <option value="homework">Homework / Task</option>
                <option value="exam">Exam / Test</option>
                <option value="reminder">Reminder</option>
                <option value="notice">Faculty Notice</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="normal">Normal Priority (Inbox only)</option>
                <option value="urgent">Urgent Notice (Single Toast + Inbox)</option>
                <option value="emergency">Emergency Broadcast</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Target Role Audience
              </label>
              <select
                value={targetRoleAudience}
                onChange={(e) => setTargetRoleAudience(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Campus Roles</option>
                <option value="student">Students Only</option>
                <option value="faculty">Teachers & Coordinators Only</option>
                <option value="admin">Admins & Leadership Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Auto-Expiry Window
              </label>
              <select
                value={ttlHours}
                onChange={(e) => setTtlHours(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                <option value={24}>24 Hours</option>
                <option value={72}>72 Hours (Default)</option>
                <option value={168}>7 Days</option>
              </select>
            </div>
          </div>

          {isTeacher && (
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-indigo-500/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                <Filter className="w-4 h-4 text-indigo-400" />
                Target Cohort
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Grade</label>
                  <select
                    value={targetGrade}
                    onChange={(e) => setTargetGrade(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                  >
                    <option value="All Grades">All Grades</option>
                    {Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Section</label>
                  <select
                    value={targetSection}
                    onChange={(e) => setTargetSection(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                  >
                    <option value="All Sections">All Sections</option>
                    <option value="Astra">Section Astra</option>
                    <option value="Elara">Section Elara</option>
                    <option value="Solara">Section Solara</option>
                    <option value="Vega">Section Vega</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={targetSubject}
                    onChange={(e) => setTargetSubject(e.target.value)}
                    placeholder="e.g. Physics"
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Broadcast Content
            </label>
            <textarea
              required
              rows={4}
              placeholder="Write the full broadcast message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500 resize-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !message.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <span>Publishing...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Publish Broadcast</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
