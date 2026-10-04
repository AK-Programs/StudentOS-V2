import React, { useState } from 'react';
import { Megaphone, Send, X, ShieldAlert, Users, Sparkles, Filter, BellRing } from 'lucide-react';
import { UserProfile, AppNotification } from '../types';
import { saveAppNotification } from '../lib/notifications';
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
  
  // Target audience for teachers
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
      const notifId = `broadcast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      
      const newNotif: AppNotification = {
        id: notifId,
        title: title.trim(),
        message: message.trim(),
        type: category === 'notice' ? 'announcement' : category,
        createdAt: new Date().toISOString(),
        isRead: false,
        targetUserId: 'all',
        targetClass: targetGrade !== 'All Grades' ? `${targetGrade}_${targetSection}` : undefined,
        linkTab: category === 'homework' ? 'homework' : 'dashboard',
      };

      // 1. Save to database
      await saveAppNotification(newNotif);

      // 2. Broadcast live event on Supabase channel
      const broadcastPayload = {
        id: notifId,
        title: title.trim(),
        message: message.trim(),
        senderName: currentUser?.name || 'School Principal',
        senderRole: currentUser?.role || 'admin',
        priority,
        category,
        targetGrade,
        targetSection,
        targetSubject,
        createdAt: new Date().toISOString(),
      };

      const channel = supabase.channel('student-os-public');
      await channel.send({
        type: 'broadcast',
        event: 'principal_live_broadcast',
        payload: broadcastPayload,
      });

      await channel.send({
        type: 'broadcast',
        event: 'new_app_notification',
        payload: newNotif,
      });

      if (showNotification) {
        showNotification('📢 Realtime broadcast published successfully to all devices!');
      }

      // Clear form
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
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
              <Megaphone className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                {isPrincipal ? 'Principal Live Broadcast' : 'Teacher Class Broadcast'}
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  Realtime
                </span>
              </h3>
              <p className="text-xs text-slate-400">Instant school-wide push notification & banner</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSendBroadcast} className="mt-5 space-y-4">
          
          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Notice Title
            </label>
            <input
              type="text"
              required
              placeholder={isPrincipal ? "e.g. Tomorrow school starts at 8:30 AM" : "e.g. Physics Lab Assignment Due Tomorrow"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-slate-500"
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="announcement">📢 Announcement</option>
                <option value="homework">📚 Homework / Task</option>
                <option value="exam">✏️ Exam / Test</option>
                <option value="reminder">⏰ Reminder</option>
                <option value="notice">📋 Faculty Notice</option>
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
                <option value="normal">🔵 Normal Priority</option>
                <option value="urgent">🟠 Urgent Notice</option>
                <option value="emergency">🔴 Emergency Broadcast</option>
              </select>
            </div>
          </div>

          {/* Teacher Targeted Filters */}
          {isTeacher && (
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-indigo-500/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                <Filter className="w-4 h-4 text-indigo-400" />
                Target Audience
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
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

          {/* Notice Message */}
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

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !message.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <span>Broadcasting...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Realtime Broadcast</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
