import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Brain, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  Trophy,
  Flame,
  Target,
  Plus,
  LayoutGrid,
  ChevronRight
} from 'lucide-react';
import { UserProfile, FlashcardDeck, Task } from '../types';
import { fetchSupabaseDecks, fetchSupabaseCards, getCanonicalUserId } from '../lib/flashcardStorage';
import { getPersonalTasks } from '../lib/supabaseTasks';
import { SyllabusTimetableService } from '../lib/syllabusTimetableService';
import { StudySessionItem } from '../types/syllabusTimetable';
import { NumberTicker, BorderBeam, CardSpotlight } from './ui/animatedComponents';
import { soundService } from '../lib/soundService';

interface StudyHubDashboardProps {
  currentUser: UserProfile;
  onNavigateTab: (tab: string, subTab?: string, contextId?: string) => void;
  dueCardsCount: number;
  tasks: Task[];
}

export const StudyHubDashboard: React.FC<StudyHubDashboardProps> = ({
  currentUser,
  onNavigateTab,
  dueCardsCount,
  tasks
}) => {
  const userId = getCanonicalUserId(currentUser?.uid || currentUser?.email);
  
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [sessions, setSessions] = useState<StudySessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fetchedDecks, fetchedSessions] = await Promise.all([
          fetchSupabaseDecks(userId),
          SyllabusTimetableService.getStudySessions(userId)
        ]);
        setDecks(fetchedDecks);
        setSessions(fetchedSessions);
      } catch (error) {
        console.error('[StudyHub] Dashboard data load error:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId]);

  const pendingTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks]);
  const activeSessions = useMemo(() => sessions.filter(s => s.status === 'pending'), [sessions]);

  const quickActions = [
    {
      id: 'tasks',
      label: 'New Task',
      icon: <Plus className="w-4 h-4" />,
      color: 'bg-indigo-600 hover:bg-indigo-500',
      action: () => onNavigateTab('study_hub', 'tasks')
    },
    {
      id: 'flashcards',
      label: 'New Deck',
      icon: <LayoutGrid className="w-4 h-4" />,
      color: 'bg-emerald-600 hover:bg-emerald-500',
      action: () => onNavigateTab('study_hub', 'flashcards')
    },
    {
      id: 'planner',
      label: 'Plan Session',
      icon: <Calendar className="w-4 h-4" />,
      color: 'bg-amber-600 hover:bg-amber-500',
      action: () => onNavigateTab('study_hub', 'planner')
    }
  ];

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-mono">Syncing Study Hub Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Header */}
      <div className="relative p-6 sm:p-10 rounded-[2.5rem] bg-gradient-to-br from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/30 overflow-hidden shadow-2xl">
        <BorderBeam size={250} duration={12} colorFrom="#6366f1" colorTo="#ec4899" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest text-indigo-300">
              <Sparkles className="w-3.5 h-3.5" /> Study Command Center
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-display text-white tracking-tight">
              Ready for your next <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Breakthrough?</span>
            </h2>
            <p className="text-slate-400 max-w-xl text-sm sm:text-base leading-relaxed">
              Your personalized learning dashboard. Review your due flashcards, manage urgent tasks, and follow your optimized study planner.
            </p>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center justify-center p-6 bg-slate-900/80 rounded-[2rem] border border-white/5 min-w-[120px] shadow-inner">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Due Cards</span>
              <NumberTicker value={dueCardsCount} className="text-3xl font-black text-white" />
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-slate-900/80 rounded-[2rem] border border-white/5 min-w-[120px] shadow-inner">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Open Tasks</span>
              <NumberTicker value={pendingTasks.length} className="text-3xl font-black text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Focus Card */}
        <CardSpotlight className="lg:col-span-2 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-400" />
                Today's Learning Focus
              </h3>
              <p className="text-xs text-slate-400">Priority objectives and scheduled study blocks.</p>
            </div>
            <button 
              onClick={() => onNavigateTab('study_hub', 'planner')}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              <Calendar className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Urgent Tasks Preview */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-2">🔥 Top Tasks</span>
              <div className="space-y-2">
                {pendingTasks.slice(0, 3).map(task => (
                  <div 
                    key={task.id}
                    onClick={() => onNavigateTab('study_hub', 'tasks')}
                    className="p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate flex-1">{task.title}</span>
                    </div>
                  </div>
                ))}
                {pendingTasks.length === 0 && (
                  <div className="p-8 text-center bg-black/20 rounded-2xl border border-dashed border-white/5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">All tasks clear!</p>
                  </div>
                )}
                <button 
                  onClick={() => onNavigateTab('study_hub', 'tasks')}
                  className="w-full py-2.5 text-[11px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest text-center"
                >
                  View all tasks <ArrowRight className="w-3 h-3 inline ml-1" />
                </button>
              </div>
            </div>

            {/* Upcoming Sessions Preview */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-2">📅 Study Timetable</span>
              <div className="space-y-2">
                {activeSessions.slice(0, 3).map(sess => (
                  <div 
                    key={sess.id}
                    onClick={() => onNavigateTab('study_hub', 'planner')}
                    className="p-3.5 rounded-2xl bg-indigo-600/5 border border-indigo-500/10 hover:border-indigo-500/30 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{sess.subject}</span>
                      <span className="text-[9px] font-mono font-bold text-slate-500">{sess.startTime}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                      {sess.chapterTitle || sess.sessionType.replace('_', ' ')}
                    </p>
                  </div>
                ))}
                {activeSessions.length === 0 && (
                  <div className="p-8 text-center bg-black/20 rounded-2xl border border-dashed border-white/5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">No sessions planned</p>
                  </div>
                )}
                <button 
                  onClick={() => onNavigateTab('study_hub', 'planner')}
                  className="w-full py-2.5 text-[11px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest text-center"
                >
                  Open planner <ArrowRight className="w-3 h-3 inline ml-1" />
                </button>
              </div>
            </div>
          </div>
        </CardSpotlight>

        {/* Right Column Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="p-5 rounded-[2rem] bg-slate-900 border border-white/10 space-y-4 shadow-xl">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Quick Actions</h4>
            <div className="space-y-2">
              {quickActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => {
                    soundService.playButtonClick();
                    action.action();
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl ${action.color} text-white font-bold text-xs transition-all active:scale-95 shadow-md`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      {action.icon}
                    </div>
                    <span>{action.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>
              ))}
            </div>
          </div>

          {/* Spaced Repetition Card */}
          <div 
            onClick={() => onNavigateTab('study_hub', 'flashcards', 'all-due')}
            className="p-6 rounded-[2rem] bg-gradient-to-br from-violet-900/40 to-indigo-900/40 border border-violet-500/30 cursor-pointer group hover:scale-[1.02] transition-all shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-violet-600/20 rounded-2xl border border-violet-500/30 group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6 text-violet-300" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight">Active Recall</h4>
                <p className="text-[10px] text-violet-300/70">Master your memory</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/80">Pending Reviews</span>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-black font-mono text-[10px] animate-pulse">
                  {dueCardsCount}
                </span>
              </div>
              <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-400 h-full transition-all duration-1000" 
                  style={{ width: dueCardsCount > 0 ? '70%' : '100%' }}
                />
              </div>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest pt-2 flex items-center gap-1">
                Start Studying <ArrowRight className="w-3 h-3" />
              </p>
            </div>
          </div>

          {/* Stats/Achievements Placeholder */}
          <div className="p-6 rounded-[2rem] bg-slate-900 border border-white/10 space-y-4 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Trophy className="w-16 h-16 text-amber-500 rotate-12" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Global Streak</h4>
              </div>
              <div className="flex items-end gap-2">
                <NumberTicker value={currentUser.streakDays || 5} className="text-4xl font-black text-white leading-none" />
                <span className="text-[11px] font-black text-slate-500 uppercase pb-1">Days Strong</span>
              </div>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400">Next milestone</span>
                <span className="text-[10px] font-black text-amber-400">7 Days</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
